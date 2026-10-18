import ExpoModulesCore
import Security

public final class MosaicastPeerModule: Module {
  private let server = PeerHTTP()
  public func definition() -> ModuleDefinition {
    Name("MosaicastPeer")
    Events("request")
    OnCreate {
      self.server.request = { [weak self] id, method, path, body in
        self?.sendEvent("request", ["id": id, "method": method, "path": path, "body": body])
      }
    }
    AsyncFunction("start") { (host: String, promise: Promise) in
      self.server.start(host) { ready in
        if ready { promise.resolve(nil) } else { promise.reject("ERR_PEER_LISTEN", "Local listener unavailable. Check Wi-Fi and local-network permission.") }
      }
    }
    Function("localAddress") { LocalAddress.read() }
    Function("stop") { self.server.stop() }
    Function("respond") { (id: String, status: Int, body: String) in self.server.respond(id, status, body) }
    Function("randomHex") { (length: Int) -> String in
      guard (1...64).contains(length) else { throw NSError(domain: "MosaicastPeer", code: 1) }
      var bytes = [UInt8](repeating: 0, count: length)
      guard SecRandomCopyBytes(kSecRandomDefault, length, &bytes) == errSecSuccess else { throw NSError(domain: "MosaicastPeer", code: 2) }
      return bytes.map { String(format: "%02x", $0) }.joined()
    }
    OnAppEntersBackground { self.server.stop() }
    OnDestroy { self.server.stop() }
  }
}
