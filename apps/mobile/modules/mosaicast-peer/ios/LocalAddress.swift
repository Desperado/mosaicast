import Foundation
import Darwin

// Read only the iPhone Wi-Fi interface used by PeerHTTP. Default routes (VPN)
// and other en* interfaces (USB/Ethernet) must not choose the advertised address.
enum LocalAddress {
  struct Interface {
    let name: String
    let isUp: Bool
    let address: String?
  }

  static func privateIPv4(_ value: String) -> Bool {
    let parts = value.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 4 else { return false }
    let numbers = parts.compactMap { Int($0) }
    guard numbers.count == 4, zip(parts, numbers).allSatisfy({ String($0.1) == $0.0 }), numbers.allSatisfy({ (0...255).contains($0) }), (1...254).contains(numbers[3]) else { return false }
    return numbers[0] == 10 || (numbers[0] == 192 && numbers[1] == 168) || (numbers[0] == 172 && (16...31).contains(numbers[1]))
  }

  static func select(_ interfaces: [Interface]) -> [String: String] {
    let wifi = interfaces.filter { $0.name == "en0" && $0.isUp }
    guard !wifi.isEmpty else { return ["code": "WIFI_UNAVAILABLE"] }
    let addresses = wifi.compactMap { $0.address }
    guard !addresses.isEmpty else { return ["code": "WIFI_NO_IPV4"] }
    guard let address = addresses.first(where: privateIPv4) else { return ["code": "WIFI_NONPRIVATE_IPV4"] }
    return ["address": address]
  }

  static func read() -> [String: String] {
    var first: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&first) == 0 else { return ["code": "INTERFACE_READ_FAILED"] }
    defer { freeifaddrs(first) }
    var interfaces: [Interface] = []
    var cursor = first
    while let current = cursor {
      let entry = current.pointee
      cursor = entry.ifa_next
      let name = String(cString: entry.ifa_name)
      guard name == "en0" else { continue }
      var address: String?
      if let socket = entry.ifa_addr, socket.pointee.sa_family == UInt8(AF_INET) {
        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        if getnameinfo(socket, socklen_t(socket.pointee.sa_len), &hostname, socklen_t(hostname.count), nil, 0, NI_NUMERICHOST) == 0 {
          address = String(cString: hostname)
        }
      }
      interfaces.append(Interface(name: name, isUp: entry.ifa_flags & UInt32(IFF_UP) != 0, address: address))
    }
    return select(interfaces)
  }
}
