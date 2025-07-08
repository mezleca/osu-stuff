#include <napi.h>
#include <iostream>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <mutex>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <sndfile.h>
#include <unordered_map>
#include <set>

using namespace std;

const set<string> VIDEO_EXTENSIONS = { ".avi", ".mov", ".mp4", ".flv" };
const size_t PROGRESS_UPDATE_INTERVAL = 100;

string trim(const string& s) {
	size_t start = s.find_first_not_of(" \t\r\n");

	if (start == string::npos) {
		return "";
	}

	size_t end = s.find_last_not_of(" \t\r\n");
	return s.substr(start, end - start + 1);
}

vector<string> split(const string& s, char delim) {
	vector<string> result;
	stringstream ss(s);
	string item;

	while (getline(ss, item, delim)) {
		result.push_back(item);
	}

	return result;
}

struct AudioInfo {
	bool success = false;
	string audio_path;
	double duration = 0.0;
};

struct BeatmapObject {
	string md5;
	string unique_id;
	string file_path;
};

// @TODO: process more data
struct BeatmapInfo {
	bool success = false;
	string md5;
	string unique_id;
	string reason;
	string audio_path;
	string image_path;
	double duration = 0.0;
};

struct OsuFileInfo {
	string audio_filename;
	string image_filename;
};

class AudioCache {
private:
	unordered_map<string, AudioInfo> cache;
	mutable mutex cache_mutex;
public:
	bool find(const string& key, AudioInfo& info) const {
		lock_guard<mutex> lock(cache_mutex);
		auto it = cache.find(key);
		if (it != cache.end()) {
			info = it->second;
			return true;
		}
		return false;
	}

	void insert(const string& key, const AudioInfo& info) {
		lock_guard<mutex> lock(cache_mutex);
		cache[key] = info;
	}

	void clear() {
		lock_guard<mutex> lock(cache_mutex);
		cache.clear();
	}
};

AudioCache audio_cache;

OsuFileInfo parse_osu_file(const string& osu_file_path) {
	OsuFileInfo info;
	ifstream file(osu_file_path);

	if (!file.is_open()) {
		return info;
	}

	string line;

	bool in_general = false;
	bool in_events = false;

	while (getline(file, line)) {
		line = trim(line);
		if (line.empty() || line[0] == '/') continue;
		if (line[0] == '[') {
			in_general = (line == "[General]");
			in_events = (line == "[Events]");
			continue;
		}
		if (in_general) {
			size_t pos = line.find(':');
			if (pos != string::npos) {
				string key = trim(line.substr(0, pos));
				if (key == "AudioFilename") {
					info.audio_filename = trim(line.substr(pos + 1));
				}
			}
		}
		else if (in_events) {
			vector<string> parts = split(line, ',');
			// lol
			if (parts.size() >= 3 && parts[0] == "0" && parts[1] == "0") {
				string filename = parts[2];

				if (filename[0] == '"' && filename.back() == '"') {
					filename = filename.substr(1, filename.length() - 2);
				}

				string ext = filename.substr(filename.find_last_of("."));

				if (VIDEO_EXTENSIONS.find(ext) == VIDEO_EXTENSIONS.end()) {
					info.image_filename = filename;
					break;
				}
			}
		}
	}

	return info;
}

AudioInfo get_audio_information(const string& audio_id, const string& path) {
	AudioInfo audio_info;

	if (audio_cache.find(audio_id, audio_info)) {
		return audio_info;
	}

	if (!filesystem::exists(path)) {
		return audio_info;
	}

	SF_INFO sfinfo{};
	SNDFILE* file = sf_open(path.c_str(), SFM_READ, &sfinfo);

	if (!file) {
		return audio_info;
	}

	audio_info.duration = static_cast<double>(sfinfo.frames) / sfinfo.samplerate;
	audio_info.audio_path = path;
	audio_info.success = true;

	sf_close(file);
	audio_cache.insert(audio_id, audio_info);
	return audio_info;
}

// Process a single beatmap
BeatmapInfo get_beatmap_info(const BeatmapObject& beatmap) {
	BeatmapInfo info;

	if (beatmap.file_path.empty() || !filesystem::exists(beatmap.file_path)) {
		info.reason = "beatmap file not found";
		return info;
	}

	info.md5 = beatmap.md5;
	info.unique_id = beatmap.unique_id;

	OsuFileInfo osu_info = parse_osu_file(beatmap.file_path);

	if (osu_info.audio_filename.empty()) {
		info.reason = "audio filename not found";
		return info;
	}

	filesystem::path osu_path(beatmap.file_path);
	filesystem::path audio_path = osu_path.parent_path() / osu_info.audio_filename;
	
	if (!filesystem::exists(audio_path)) {
		info.reason = "audio file not found";
		return info;
	}

	info.audio_path = audio_path.string();

	if (!osu_info.image_filename.empty()) {
		filesystem::path image_path = osu_path.parent_path() / osu_info.image_filename;
		if (filesystem::exists(image_path)) {
			info.image_path = image_path.string();
		}
	}

	AudioInfo audio_info = get_audio_information(info.unique_id, info.audio_path);
	info.success = audio_info.success;

	if (!info.success) {
		info.reason = "failed to get audio data";
		return info;
	}

	info.duration = audio_info.duration;
	return info;
}

class AudioProcessor : public Napi::AsyncWorker {
public:
	AudioProcessor(Napi::Env env, const vector<BeatmapObject>& files, Napi::Function progress_cb)
		: Napi::AsyncWorker(env),
		has_callback(false),
		beatmap_files(files),
		promise_deferred(Napi::Promise::Deferred::New(env)),
		processed_count(0),
		shutdown_requested(false) {
		if (!progress_cb.IsEmpty() && progress_cb.IsFunction()) {
			progress_callback = Napi::ThreadSafeFunction::New(
				env, progress_cb, "ProgressCallback", 0, 1,
				[this](Napi::Env) { this->shutdown_requested = true; }
			);
			has_callback = true;
		}
	}

	void Execute() override {
		size_t thread_count = min(4u, thread::hardware_concurrency());

		if (thread_count == 0) {
			thread_count = 1;
		}

		size_t total_beatmaps = beatmap_files.size();
		audio_results.resize(total_beatmaps);
		vector<thread> threads;
		size_t chunk_size = total_beatmaps / thread_count + (total_beatmaps % thread_count ? 1 : 0);

		auto worker = [&](size_t start, size_t end) {
			for (size_t i = start; i < end && !shutdown_requested; ++i) {
				audio_results[i] = get_beatmap_info(beatmap_files[i]);
				size_t current = ++processed_count;
				// send 100 otherwise shit will lag
				if (has_callback && (current % PROGRESS_UPDATE_INTERVAL == 0 || current == total_beatmaps)) {
					progress_callback.NonBlockingCall(
						[current](Napi::Env env, Napi::Function cb) {
							cb.Call({ Napi::Number::New(env, current) });
						}
					);
				}
			}
		};

		for (size_t t = 0; t < thread_count; ++t) {
			size_t start = t * chunk_size;
			size_t end = min(start + chunk_size, total_beatmaps);

			if (start < total_beatmaps) {
				threads.emplace_back(worker, start, end);
			}
		}

		for (auto& t : threads) {
			t.join();
		}
	}

	void OnOK() override {
		if (shutdown_requested) {
			return;
		}

		Napi::Array result = Napi::Array::New(Env(), audio_results.size());

		for (size_t i = 0; i < audio_results.size(); ++i) {
			Napi::Object obj = Napi::Object::New(Env());
			const auto& data = audio_results[i];

			obj.Set("md5", data.md5);
			obj.Set("unique_id", data.unique_id);
			obj.Set("audio_path", data.audio_path);
			obj.Set("image_path", data.image_path);
			obj.Set("success", data.success);
			obj.Set("duration", data.duration);

			if (!data.success) {
				obj.Set("reason", data.reason);
			}

			result.Set(i, obj);
		}

		cleanup_callback();
		promise_deferred.Resolve(result);
	}

	void OnError(const Napi::Error& error) override {
		cleanup_callback();
		promise_deferred.Reject(error.Value());
	}

	Napi::Promise GetPromise() { return promise_deferred.Promise(); }

private:
	void cleanup_callback() {
		if (has_callback) {
			progress_callback.Release();
			has_callback = false;
		}
	}

	bool has_callback;
	vector<BeatmapObject> beatmap_files;
	vector<BeatmapInfo> audio_results;
	Napi::ThreadSafeFunction progress_callback;
	Napi::Promise::Deferred promise_deferred;
	atomic<size_t> processed_count;
	atomic<bool> shutdown_requested;
};

Napi::Value process_beatmaps(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	if (info.Length() < 1 || !info[0].IsArray()) {
		cerr << "error: invalid function arguments" << endl;
		return env.Null();
	}

	Napi::Array beatmap_list = info[0].As<Napi::Array>();
	vector<BeatmapObject> beatmaps;

	for (uint32_t i = 0; i < beatmap_list.Length(); ++i) {
		Napi::Object current_beatmap = beatmap_list.Get(i).As<Napi::Object>();

		if (!current_beatmap.Has("unique_id") || !current_beatmap.Has("file_path") || !current_beatmap.Has("md5")) {
			cerr << "error: missing required fields at index: " << i << endl;
			return env.Null();
		}

		string unique_id = current_beatmap.Get("unique_id").As<Napi::String>().Utf8Value();
		string file_path = current_beatmap.Get("file_path").As<Napi::String>().Utf8Value();
		string md5 = current_beatmap.Get("md5").As<Napi::String>().Utf8Value();

		beatmaps.push_back({ md5, unique_id, file_path });
	}

	Napi::Function progress_cb = info.Length() > 1 && info[1].IsFunction() ? info[1].As<Napi::Function>() : Napi::Function();
	AudioProcessor* worker = new AudioProcessor(env, beatmaps, progress_cb);
	Napi::Promise promise = worker->GetPromise();

	worker->Queue();
	return promise;
}

Napi::Value test(const Napi::CallbackInfo& info) {
	return Napi::String::New(info.Env(), "Hello from C++");
}

Napi::Value clear_cache(const Napi::CallbackInfo& info) {
	audio_cache.clear();
	return Napi::Boolean::New(info.Env(), true);
}

Napi::Object initialize(Napi::Env env, Napi::Object exports) {
	cout << "using libsnd " << sf_version_string() << endl;
	
	exports.Set("process_beatmaps", Napi::Function::New(env, process_beatmaps));
	exports.Set("test", Napi::Function::New(env, test));
	exports.Set("clear_cache", Napi::Function::New(env, clear_cache));
	return exports;
}

NODE_API_MODULE(addon, initialize)
