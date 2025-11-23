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
#include <unordered_set>
#include <algorithm>

#ifdef _WIN32
#include <windows.h>

std::wstring utf8_to_wide(const std::string &utf8_str)
{
    if (utf8_str.empty())
        return std::wstring();

    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &utf8_str[0], (int)utf8_str.size(), NULL, 0);
    std::wstring wide_str(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, &utf8_str[0], (int)utf8_str.size(), &wide_str[0], size_needed);
    return wide_str;
}

std::string normalize_path_separators(const std::string &path)
{
    std::string normalized = path;
    std::replace(normalized.begin(), normalized.end(), '/', '\\');
    return normalized;
}
#endif

using namespace std;

const unordered_set<string> VIDEO_EXTENSIONS = {".avi", ".mov", ".mp4", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg"};
const unordered_set<string> IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"};
const size_t PROGRESS_UPDATE_INTERVAL = 50;

static atomic<bool> is_processing(false);

// extract types
enum class ExtractType
{
    DURATION,
    BACKGROUND,
    VIDEO
};

string trim(const string &s)
{
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == string::npos)
        return "";

    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

vector<string> split(const string &s, char delim)
{
    vector<string> result;
    stringstream ss(s);
    string item;

    while (getline(ss, item, delim))
    {
        result.push_back(item);
    }

    return result;
}

string get_file_extension(const string &path)
{
    size_t pos = path.find_last_of(".");
    if (pos == string::npos)
        return "";

    string ext = path.substr(pos);
    transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    return ext;
}

bool is_video_file(const string &filename)
{
    return VIDEO_EXTENSIONS.count(get_file_extension(filename)) > 0;
}

bool is_image_file(const string &filename)
{
    return IMAGE_EXTENSIONS.count(get_file_extension(filename)) > 0;
}

struct ExtractedData
{
    double duration = 0.0;
    string background;
    string video;
};

struct ProcessorInput
{
    string md5;
    string unique_id;
    string file_path;
    string last_modified;
    unordered_set<ExtractType> extract_types;
};

struct ProcessorResult
{
    bool success = false;
    string md5;
    string unique_id;
    string reason;
    string last_modified;
    ExtractedData data;
};

struct OsuFileData
{
    string audio_filename;
    string background_filename;
    string video_filename;
};

class AudioCache
{
private:
    unordered_map<string, double> cache;
    mutable mutex cache_mutex;

public:
    bool get(const string &key, double &duration) const
    {
        lock_guard<mutex> lock(cache_mutex);
        auto it = cache.find(key);
        if (it != cache.end())
        {
            duration = it->second;
            return true;
        }
        return false;
    }

    void set(const string &key, double duration)
    {
        lock_guard<mutex> lock(cache_mutex);
        cache[key] = duration;
    }

    void clear()
    {
        lock_guard<mutex> lock(cache_mutex);
        cache.clear();
    }
};

AudioCache audio_cache;

OsuFileData parse_osu_file(const string &osu_file_path, const unordered_set<ExtractType> &extract_types)
{
    OsuFileData data;

#ifdef _WIN32
    wstring wide_path = utf8_to_wide(osu_file_path);
    ifstream file(wide_path, ios::binary);
#else
    ifstream file(osu_file_path);
#endif

    if (!file.is_open())
        return data;

    string line;

    bool in_general = false;
    bool in_events = false;

    bool need_audio = extract_types.count(ExtractType::DURATION) > 0;
    bool need_background = extract_types.count(ExtractType::BACKGROUND) > 0;
    bool need_video = extract_types.count(ExtractType::VIDEO) > 0;

    while (getline(file, line))
    {
        line = trim(line);

        if (line.empty() || line[0] == '/')
            continue;

        if (line[0] == '[')
        {
            in_general = (line == "[General]");
            in_events = (line == "[Events]");
            continue;
        }

        if (in_general && need_audio)
        {
            size_t pos = line.find(':');
            if (pos != string::npos)
            {
                string key = trim(line.substr(0, pos));
                if (key == "AudioFilename")
                {
                    string filename = trim(line.substr(pos + 1));
#ifdef _WIN32
                    filename = normalize_path_separators(filename);
#endif
                    data.audio_filename = filename;
                }
            }
        }
        else if (in_events && (need_background || need_video))
        {
            vector<string> parts = split(line, ',');

            // background / video entry format: type,start_time,"filename",...
            if (parts.size() >= 3 && parts[0] == "0" && parts[1] == "0")
            {
                string filename = trim(parts[2]);

                // remove quotes
                if (filename.length() >= 2 && filename[0] == '"' && filename.back() == '"')
                {
                    filename = filename.substr(1, filename.length() - 2);
                }

                if (is_video_file(filename))
                {
                    if (need_video)
                    {
#ifdef _WIN32
                        filename = normalize_path_separators(filename);
#endif
                        data.video_filename = filename;
                    }
                }
                else if (is_image_file(filename))
                {
                    if (need_background)
                    {
#ifdef _WIN32
                        filename = normalize_path_separators(filename);
#endif
                        data.background_filename = filename;
                    }
                }
            }
        }
    }

    return data;
}

double get_audio_duration(const string &audio_id, const string &audio_path)
{
    double cached_duration;

    if (audio_cache.get(audio_id, cached_duration))
        return cached_duration;

    if (!filesystem::exists(audio_path))
        return 0.0;

    SF_INFO sfinfo{};
    SNDFILE *file = sf_open(audio_path.c_str(), SFM_READ, &sfinfo);

    if (!file)
        return 0.0;

    double duration = static_cast<double>(sfinfo.frames) / sfinfo.samplerate;
    sf_close(file);

    audio_cache.set(audio_id, duration);
    return duration;
}

ProcessorResult process_single_beatmap(const ProcessorInput &input)
{
    ProcessorResult result;

    result.md5 = input.md5;
    result.unique_id = input.unique_id;
    result.last_modified = input.last_modified;

    if (input.file_path.empty() || !filesystem::exists(input.file_path))
    {
        result.reason = "file not found";
        return result;
    }

    filesystem::path base_path = filesystem::path(input.file_path).parent_path();
    OsuFileData osu_data = parse_osu_file(input.file_path, input.extract_types);

    // extract duration
    if (input.extract_types.count(ExtractType::DURATION) > 0)
    {
        if (osu_data.audio_filename.empty())
        {
            result.reason = "audio filename not found";
            return result;
        }

        filesystem::path audio_path = base_path / osu_data.audio_filename;

        if (!filesystem::exists(audio_path))
        {
            result.reason = "audio file not found";
            return result;
        }

        double duration = get_audio_duration(result.unique_id, audio_path.string());

        if (duration <= 0.0)
        {
            result.reason = "failed to get audio duration";
            return result;
        }

        result.data.duration = duration;
    }

    // extract background
    if (input.extract_types.count(ExtractType::BACKGROUND) > 0)
    {
        if (!osu_data.background_filename.empty())
        {
            filesystem::path bg_path = base_path / osu_data.background_filename;
            if (filesystem::exists(bg_path))
            {
                result.data.background = bg_path.string();
            }
        }
    }

    // extract video
    if (input.extract_types.count(ExtractType::VIDEO) > 0)
    {
        if (!osu_data.video_filename.empty())
        {
            filesystem::path video_path = base_path / osu_data.video_filename;
            if (filesystem::exists(video_path))
            {
                result.data.video = video_path.string();
            }
        }
    }

    result.success = true;
    return result;
}

class ProcessorWorker : public Napi::AsyncWorker
{
public:
    ProcessorWorker(
        Napi::Env env,
        const vector<ProcessorInput> &inputs,
        Napi::Function progress_cb)
        : Napi::AsyncWorker(env),
          inputs(inputs),
          has_progress_callback(false),
          processed_count(0),
          shutdown_requested(false),
          promise_deferred(Napi::Promise::Deferred::New(env))
    {
        if (!progress_cb.IsEmpty() && progress_cb.IsFunction())
        {
            progress_callback = Napi::ThreadSafeFunction::New(
                env,
                progress_cb,
                "ProgressCallback",
                0,
                1,
                [this](Napi::Env)
                { this->shutdown_requested.store(true); });

            has_progress_callback = true;
        }
    }

    void Execute() override
    {
        size_t thread_count = min(4u, thread::hardware_concurrency());
        if (thread_count == 0)
            thread_count = 1;

        size_t total = inputs.size();
        results.resize(total);

        vector<thread> threads;
        size_t chunk_size = (total + thread_count - 1) / thread_count;

        is_processing.store(true);

        auto worker = [&](size_t start, size_t end)
        {
            for (size_t i = start; i < end && !shutdown_requested.load(); ++i)
            {
                results[i] = process_single_beatmap(inputs[i]);

                size_t current = processed_count.fetch_add(1) + 1;

                if (has_progress_callback &&
                    (current % PROGRESS_UPDATE_INTERVAL == 0 || current == total))
                {
                    progress_callback.NonBlockingCall([i](Napi::Env env, Napi::Function cb)
                                                      { cb.Call({Napi::Number::New(env, i)}); });
                }
            }
        };

        for (size_t t = 0; t < thread_count; ++t)
        {
            size_t start = t * chunk_size;
            size_t end = min(start + chunk_size, total);

            if (start < total)
            {
                threads.emplace_back(worker, start, end);
            }
        }

        for (auto &t : threads)
        {
            t.join();
        }
    }

    void OnOK() override
    {
        if (shutdown_requested.load())
        {
            cleanup();
            return;
        }

        Napi::Array result_array = Napi::Array::New(Env(), results.size());

        for (size_t i = 0; i < results.size(); ++i)
        {
            Napi::Object obj = Napi::Object::New(Env());
            const auto &res = results[i];

            obj.Set("md5", res.md5);
            obj.Set("unique_id", res.unique_id);
            obj.Set("last_modified", res.last_modified);
            obj.Set("success", res.success);

            if (!res.success)
            {
                obj.Set("reason", res.reason);
            }
            else
            {
                Napi::Object data_obj = Napi::Object::New(Env());

                if (res.data.duration > 0.0)
                {
                    data_obj.Set("duration", res.data.duration);
                }

                if (!res.data.background.empty())
                {
                    data_obj.Set("background", res.data.background);
                }

                if (!res.data.video.empty())
                {
                    data_obj.Set("video", res.data.video);
                }

                obj.Set("data", data_obj);
            }

            result_array.Set(i, obj);
        }

        cleanup();
        promise_deferred.Resolve(result_array);
    }

    void OnError(const Napi::Error &error) override
    {
        cleanup();
        promise_deferred.Reject(error.Value());
    }

    Napi::Promise GetPromise()
    {
        return promise_deferred.Promise();
    }

private:
    void cleanup()
    {
        is_processing.store(false);
        inputs.clear();
        results.clear();

        if (has_progress_callback)
        {
            progress_callback.Release();
            has_progress_callback = false;
        }
    }

    vector<ProcessorInput> inputs;
    vector<ProcessorResult> results;
    bool has_progress_callback;
    Napi::ThreadSafeFunction progress_callback;
    Napi::Promise::Deferred promise_deferred;
    atomic<size_t> processed_count;
    atomic<bool> shutdown_requested;
};

Napi::Value process_beatmaps(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    if (is_processing.load())
    {
        cerr << "[processor] already processing" << endl;
        Napi::Error error = Napi::Error::New(env, "processor is already running");
        deferred.Reject(error.Value());
        return deferred.Promise();
    }

    if (info.Length() < 1 || !info[0].IsArray())
    {
        cerr << "[processor] invalid arguments" << endl;
        Napi::Error error = Napi::Error::New(env, "first argument must be an array");
        deferred.Reject(error.Value());
        return deferred.Promise();
    }

    Napi::Array input_array = info[0].As<Napi::Array>();
    vector<ProcessorInput> inputs;

    try 
    {
        for (uint32_t i = 0; i < input_array.Length(); ++i)
        {
            Napi::Object obj = input_array.Get(i).As<Napi::Object>();

            if (!obj.Has("md5") || !obj.Has("file_path") || !obj.Has("extract"))
            {
                string error_msg = "missing required fields at index " + to_string(i);
                cerr << "[processor] " << error_msg << endl;
                
                Napi::Error error = Napi::Error::New(env, error_msg);
                deferred.Reject(error.Value());
                return deferred.Promise();
            }

            ProcessorInput input;
            cout << "attempting to parse md5\n";
            input.md5 = obj.Get("md5").As<Napi::String>().Utf8Value();
            cout << "attempting to parse file_path\n";
            input.file_path = obj.Get("file_path").As<Napi::String>().Utf8Value();
            cout << "attempting to parse last_modified\n";
            input.last_modified = obj.Get("last_modified").As<Napi::String>().Utf8Value();

            cout << "attempting to parse unique_id\n";

            if (obj.Has("unique_id"))
            {
                input.unique_id = obj.Get("unique_id").As<Napi::String>().Utf8Value();
            }
            else
            {
                input.unique_id = input.md5;
            }

            Napi::Array extract_array = obj.Get("extract").As<Napi::Array>();

            for (uint32_t j = 0; j < extract_array.Length(); ++j)
            {
                cout << "attempting to parse " << j << "of " << extract_array.Length() << "\n";
                string extract_type = extract_array.Get(j).As<Napi::String>().Utf8Value();

                if (extract_type == "duration")
                {
                    input.extract_types.insert(ExtractType::DURATION);
                }
                else if (extract_type == "background")
                {
                    input.extract_types.insert(ExtractType::BACKGROUND);
                }
                else if (extract_type == "video")
                {
                    input.extract_types.insert(ExtractType::VIDEO);
                }
            }

            inputs.push_back(input);
        }
    }
    catch (const exception &e)
    {
        string error_msg = "failed to parse input: ";
        error_msg += e.what();
        cerr << "[processor] " << error_msg << endl;
        
        Napi::Error error = Napi::Error::New(env, error_msg);
        deferred.Reject(error.Value());
        return deferred.Promise();
    }

    Napi::Function progress_cb = info.Length() > 1 && info[1].IsFunction()
                                     ? info[1].As<Napi::Function>()
                                     : Napi::Function();

    ProcessorWorker *worker = new ProcessorWorker(env, inputs, progress_cb);
    Napi::Promise promise = worker->GetPromise();

    worker->Queue();
    return promise;
}

Napi::Value clear_cache(const Napi::CallbackInfo &info)
{
    audio_cache.clear();
    return Napi::Boolean::New(info.Env(), true);
}

Napi::Value get_is_processing(const Napi::CallbackInfo &info)
{
    return Napi::Boolean::New(info.Env(), is_processing.load());
}

Napi::Object initialize(Napi::Env env, Napi::Object exports)
{
    cout << "[processor] using libsndfile " << sf_version_string() << endl;

    exports.Set("process_beatmaps", Napi::Function::New(env, process_beatmaps));
    exports.Set("clear_cache", Napi::Function::New(env, clear_cache));
    exports.Set("is_processing", Napi::Function::New(env, get_is_processing));

    return exports;
}

NODE_API_MODULE(addon, initialize)