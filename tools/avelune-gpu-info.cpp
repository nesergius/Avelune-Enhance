#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <dxgi1_2.h>
#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>

static std::string utf8(const wchar_t* value) {
    if (!value) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, value, -1, nullptr, 0, nullptr, nullptr);
    if (size <= 1) return "";
    std::string result(static_cast<size_t>(size - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value, -1, result.data(), size, nullptr, nullptr);
    return result;
}

static std::string jsonEscape(const std::string& value) {
    std::ostringstream out;
    for (unsigned char ch : value) {
        switch (ch) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (ch < 0x20) {
                    out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(ch);
                } else {
                    out << static_cast<char>(ch);
                }
        }
    }
    return out.str();
}

int wmain() {
    SetConsoleOutputCP(CP_UTF8);
    IDXGIFactory1* factory = nullptr;
    HRESULT hr = CreateDXGIFactory1(__uuidof(IDXGIFactory1), reinterpret_cast<void**>(&factory));
    if (FAILED(hr) || !factory) {
        std::cerr << "{\"error\":\"CreateDXGIFactory1 failed\",\"hresult\":" << static_cast<unsigned long>(hr) << "}";
        return 2;
    }

    std::cout << "{\"adapters\":[";
    bool first = true;
    for (UINT index = 0; ; ++index) {
        IDXGIAdapter1* adapter = nullptr;
        hr = factory->EnumAdapters1(index, &adapter);
        if (hr == DXGI_ERROR_NOT_FOUND) break;
        if (FAILED(hr) || !adapter) continue;

        DXGI_ADAPTER_DESC1 desc{};
        if (SUCCEEDED(adapter->GetDesc1(&desc))) {
            if (!first) std::cout << ',';
            first = false;
            const std::string name = jsonEscape(utf8(desc.Description));
            std::cout
                << "{\"index\":" << index
                << ",\"name\":\"" << name << "\""
                << ",\"vendorId\":" << desc.VendorId
                << ",\"deviceId\":" << desc.DeviceId
                << ",\"subsystemId\":" << desc.SubSysId
                << ",\"revision\":" << desc.Revision
                << ",\"dedicatedVideoMemoryBytes\":" << static_cast<unsigned long long>(desc.DedicatedVideoMemory)
                << ",\"dedicatedSystemMemoryBytes\":" << static_cast<unsigned long long>(desc.DedicatedSystemMemory)
                << ",\"sharedSystemMemoryBytes\":" << static_cast<unsigned long long>(desc.SharedSystemMemory)
                << ",\"softwareAdapter\":" << ((desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) ? "true" : "false")
                << '}';
        }
        adapter->Release();
    }
    factory->Release();
    std::cout << "]}";
    return 0;
}
