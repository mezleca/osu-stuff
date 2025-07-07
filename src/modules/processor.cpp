#include <napi.h>
#include <iostream>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <sndfile.h>

using namespace std;

// main struct
struct BeatmapObject {
	string id;
	string file_path;
	int32_t last_modified;
};

// @TODO: process more data
struct BeatmapInfo {
	bool success;
	string id;
	string format; // TODO
	string reason;
	string audio_path;
	string image_path;
	int64_t duration;
	int64_t last_modified;
};
// small .osu parser
// @TODO: create a global function to get any attribute like "SkinPreference from Gereral, etc..."
string get_audio_filename(const string& osu_file_path) {

	ifstream file(osu_file_path);

	if (!file.is_open()) {
		return "";
	}

	stringstream buffer;
	buffer << file.rdbuf();
	string content = buffer.str();

	size_t section_start = content.find("[General]");

	if (section_start == string::npos) {
		return "";
	}

	size_t audio_attr = content.find("AudioFilename:", section_start);

	if (audio_attr == string::npos) {
		return "";
	}

	// start after "AudioFilename: "
	size_t filename_start = audio_attr + 14;

	// skip spaces
	while (filename_start < content.length() && content[filename_start] == ' ') {
		filename_start++;
	}

	size_t line_end = content.find('\n', filename_start);

	if (line_end == string::npos) {
		line_end = content.length();
	}

	string filename = content.substr(filename_start, line_end - filename_start);

	// remove whitespace and carriage returns
	while (!filename.empty() && (filename.back() == '\r' || filename.back() == ' ')) {
		filename.pop_back();
	}

	return filename;
}

string get_image_filename(const string& osu_file_path) {
	ifstream file(osu_file_path);

	if (!file.is_open()) {
		return "";
	}

	stringstream buffer;
	buffer << file.rdbuf();
	string content = buffer.str();

	size_t section_start = content.find("[Events]");
	if (section_start == string::npos) {
		return "";
	}

	size_t content_start = section_start + 8;

	// skip line break
	if (content_start < content.length() && content[content_start] == '\n') {
		content_start++;
	}

	while (content_start < content.length()) {
		if (content[content_start] == '\n') {
			content_start++;
			continue;
		}

		size_t line_end = content.find('\n', content_start);
		if (line_end == string::npos) {
			line_end = content.length();
		}

		// skip comments
		if (content[content_start] == '/') {
			content_start = line_end + 1;
			continue;
		}

		// find quotes for image filename
		size_t first_quote = content.find('"', content_start);
		if (first_quote == string::npos || first_quote >= line_end) {
			content_start = line_end + 1;
			continue;
		}

		size_t second_quote = content.find('"', first_quote + 1);
		if (second_quote == string::npos || second_quote >= line_end) {
			content_start = line_end + 1;
			continue;
		}

		string result = content.substr(first_quote + 1, second_quote - first_quote - 1);

		size_t dot = result.find_last_of(".");
		if (dot != string::npos) {
			string ext = result.substr(dot);

			// exclude video files
			if (ext == ".avi" || ext == ".mov" || ext == ".mp4" || ext == ".flv") {
				content_start = line_end + 1;
				continue;
			}
		}

		return result;
	}

	return "";
}

string build_audio_path(const string& osu_file_path) {
	string audio_filename = get_audio_filename(osu_file_path);

	if (audio_filename.empty()) {
		return "";
	}

	filesystem::path osu_path(osu_file_path);
	filesystem::path audio_path = osu_path.parent_path() / audio_filename;

	return audio_path.string();
}

string build_image_path(const string& osu_file_path) {
	string image_filename = get_image_filename(osu_file_path);

	if (image_filename.empty()) {
		return "";
	}

	filesystem::path osu_path(osu_file_path);
	filesystem::path image_path = osu_path.parent_path() / image_filename;

	return image_path.string();
}

BeatmapInfo get_beatmap_info(const BeatmapObject& beatmap) {
	BeatmapInfo info = {};

	info.id = beatmap.id;
	info.last_modified = beatmap.last_modified;
	info.success = false;
	info.duration = 0;

	SF_INFO sfinfo;
	memset(&sfinfo, 0, sizeof(sfinfo));

	string audio_path = build_audio_path(beatmap.file_path);

	// check if audio file exists
	if (audio_path.empty()) {
		info.reason = "audio not found on .osu";
		return info;
	}

	info.audio_path = audio_path;
	SNDFILE* file = sf_open(audio_path.c_str(), SFM_READ, &sfinfo);

	if (!file) {
		info.reason = sf_strerror(file);
		return info;
	}

	// get image path
	info.duration = (double)sfinfo.frames / sfinfo.samplerate;
	info.image_path = build_image_path(beatmap.file_path);

	// clean
	sf_close(file);

	info.success = true;
	return info;
}

class AudioProcessor : public Napi::AsyncWorker {
public:
	AudioProcessor(Napi::Env env, const vector<BeatmapObject>& files, Napi::Function progress_cb)
		: Napi::AsyncWorker(env),
		beatmap_files(files),
		has_callback(false),
		promise_deferred(Napi::Promise::Deferred::New(env)),
		current_index(0),
		processed_count(0) {
		// only create a callback if we passed one in js
		if (!progress_cb.IsEmpty() && progress_cb.IsFunction()) {
			progress_callback = Napi::ThreadSafeFunction::New(env, progress_cb, "ProgressCallback", 0, 1);
			has_callback = true;
		}
	}

	void Execute() override {
		const size_t THREAD_COUNT = 2;

		vector<thread> threads;
		mutex index_mutex;

		audio_results.resize(beatmap_files.size());

		auto worker = [&]() {
			while (true) {
				size_t index;
				{
					lock_guard<mutex> lock(index_mutex);
					if (current_index >= beatmap_files.size()) {
						break;
					}
					index = current_index++;
				}

				audio_results[index] = get_beatmap_info(beatmap_files[index]);
				processed_count++;

				// to prevent huge ass lag (prob only lags on my shitty as pc)
				if (has_callback && (processed_count % 5 == 0 || processed_count == beatmap_files.size())) {
					int current = processed_count.load();
					progress_callback.NonBlockingCall([current](Napi::Env env, Napi::Function callback) {
						if (!env.IsExceptionPending()) {
							callback.Call({ Napi::Number::New(env, current) });
						}
						});
				}
			}
			};

		for (size_t i = 0; i < THREAD_COUNT; ++i) {
			threads.emplace_back(worker);
		}

		for (auto& thread : threads) {
			thread.join();
		}
	}

	void OnOK() override {
		Napi::Array result = Napi::Array::New(Env(), audio_results.size());

		for (size_t i = 0; i < audio_results.size(); ++i) {
			auto obj = Napi::Object::New(Env());
			const auto& data = audio_results[i];

			// return a new object
			obj.Set("id", data.id);
			obj.Set("audio_path", data.audio_path);
			obj.Set("image_path", data.image_path);
			obj.Set("success", data.success);
			obj.Set("duration", data.duration);
			obj.Set("last_modified", data.last_modified);

			if (!data.success) {
				obj.Set("reason", data.reason);
			}

			result.Set(i, obj);
		}

		if (has_callback) {
			progress_callback.Release();
		}

		promise_deferred.Resolve(result);
	}

	void OnError(const Napi::Error& error) override {
		if (has_callback) {
			progress_callback.Release();
		}
		promise_deferred.Reject(error.Value());
	}

	Napi::Promise GetPromise() {
		return promise_deferred.Promise();
	}

private:
	bool has_callback;
	vector<BeatmapObject> beatmap_files;
	vector<BeatmapInfo> audio_results;
	Napi::ThreadSafeFunction progress_callback;
	Napi::Promise::Deferred promise_deferred;
	atomic<size_t> current_index;
	atomic<size_t> processed_count;
};

Napi::Value process_beatmaps(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	//
	if (info.Length() < 1 || !info[0].IsArray()) {
		cout << "what are you doing bro wheres the args" << "\n";
		return env.Null();
	}

	Napi::Array beatmap_list = info[0].As<Napi::Array>();
	vector<BeatmapObject> beatmaps;

	for (uint32_t i = 0; i < beatmap_list.Length(); ++i) {
		Napi::Value beatmap_val = beatmap_list.Get(i);

		if (!beatmap_val.IsObject()) {
			cout << "not an object" << "\n";
			return env.Null();
		}

		Napi::Object current_beatmap = beatmap_val.As<Napi::Object>();

		// well id is not "needed" but
		if (!current_beatmap.Has("id") || !current_beatmap.Has("file_path")) {
			cout << "missing something idk" << "\n";
			return env.Null();
		}

		Napi::Value id_val = current_beatmap.Get("id");
		Napi::Value file_path_val = current_beatmap.Get("file_path");
		Napi::Value last_modified_val = current_beatmap.Get("last_modified");

		if (!last_modified_val.IsNumber()) {
			cout << "last_modified is not a number LUL" << "\n";
			return env.Null();
		}

		if (!id_val.IsString() || !file_path_val.IsString()) {
			cout << "not a string lil bro | " << id_val.IsString() << " | " << file_path_val.IsString() << "\n";
			return env.Null();
		}

		string id = id_val.As<Napi::String>().Utf8Value();
		string file_path = file_path_val.As<Napi::String>().Utf8Value();
		int32_t last_modified = last_modified_val.As<Napi::Number>().Int32Value();

		beatmaps.push_back({ id, file_path, last_modified });
	}

	Napi::Function progress_cb = Napi::Function();
	if (info.Length() > 1 && info[1].IsFunction()) {
		progress_cb = info[1].As<Napi::Function>();
	}

	AudioProcessor* worker = new AudioProcessor(env, beatmaps, progress_cb);
	Napi::Promise promise = worker->GetPromise();
	worker->Queue();

	return promise;
}

Napi::Value test(const Napi::CallbackInfo& info) {
	return Napi::String::New(info.Env(), "Hello from C++");
}

Napi::Object initialize(Napi::Env env, Napi::Object exports) {

	std::cout << "using libsnd " << sf_version_string() << "\n";

	// @TODO: create individual functions to get beatmap_image, etc
	exports.Set("process_beatmaps", Napi::Function::New(env, process_beatmaps));
	exports.Set("test", Napi::Function::New(env, test));
	return exports;
}

NODE_API_MODULE(addon, initialize)
