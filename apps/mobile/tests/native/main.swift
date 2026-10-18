import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}
typealias Interface = LocalAddress.Interface
let wifi = Interface(name: "en0", isUp: true, address: "192.168.188.42")
let others = [
  Interface(name: "utun4", isUp: true, address: "10.10.0.1"),
  Interface(name: "en11", isUp: true, address: "169.254.10.2"),
  Interface(name: "en2", isUp: true, address: "192.168.50.2")
]
for interfaces in [[wifi] + others, others + [wifi], [others[0], wifi, others[1]]] {
  check(LocalAddress.select(interfaces) == ["address": "192.168.188.42"], "VPN/USB must not override Wi-Fi")
}
check(LocalAddress.select(others) == ["code": "WIFI_UNAVAILABLE"], "Never advertise another interface")
check(LocalAddress.select([Interface(name: "en0", isUp: false, address: "192.168.1.2")]) == ["code": "WIFI_UNAVAILABLE"], "Ignore down Wi-Fi")
check(LocalAddress.select([Interface(name: "en0", isUp: true, address: nil)]) == ["code": "WIFI_NO_IPV4"], "IPv6-only Wi-Fi cannot be advertised")
for address in ["169.254.1.2", "0.0.0.0", "8.8.8.8", "127.0.0.1", "192.168.1.255", "192.168.1.0", "192.168.01.2", "fe80::1"] {
  check(!LocalAddress.privateIPv4(address), "Reject unusable address")
  check(LocalAddress.select([Interface(name: "en0", isUp: true, address: address)]) == ["code": "WIFI_NONPRIVATE_IPV4"], "Return safe diagnostic only")
}
for address in ["10.1.2.3", "172.16.1.2", "172.31.1.2", "192.168.1.2"] {
  check(LocalAddress.privateIPv4(address), "Accept supported private IPv4")
}
// Exercise the actual getifaddrs reader without exposing host addresses.
let live = LocalAddress.read()
check(live["address"].map(LocalAddress.privateIPv4) == true || ["WIFI_UNAVAILABLE", "WIFI_NO_IPV4", "WIFI_NONPRIVATE_IPV4", "INTERFACE_READ_FAILED"].contains(live["code"] ?? ""), "Reader must return a validated address or a fixed code")
print("Native Wi-Fi selection and interface reader passed")
