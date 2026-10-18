import Foundation
import Network

// No credentials, Yamaha routes, files or logs at this boundary. Application
// messages are authenticated/encrypted in the shared TypeScript peer protocol.
final class PeerHTTP {
  private let queue = DispatchQueue(label: "mosaicast.peer.http")
  private var listener: NWListener?
  private var connections: [String: NWConnection] = [:]
  private var responding = Set<String>()
  private var host = ""
  var request: ((String, String, String, String) -> Void)?

  static func privateAddress(_ value: String) -> Bool {
    LocalAddress.privateIPv4(value)
  }
  func start(_ address: String, completion: @escaping (Bool) -> Void) {
    queue.async {
      self.stopNow()
      guard Self.privateAddress(address) else { completion(false); return }
      self.host = address
      do {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .wifi
        parameters.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(address), port: 8095)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var completed = false
        listener.stateUpdateHandler = { state in
          if !completed {
            if case .ready = state { completed = true; completion(true) }
            if case .failed = state { completed = true; completion(false); self.stopNow() }
            if case .cancelled = state { completed = true; completion(false) }
          }
        }
        listener.newConnectionHandler = { connection in self.accept(connection) }
        listener.start(queue: self.queue)
      } catch { completion(false) }
    }
  }
  func stop() { queue.async { self.stopNow() } }
  private func stopNow() {
    listener?.cancel(); listener = nil
    for connection in connections.values { connection.cancel() }
    connections.removeAll(); responding.removeAll()
  }
  private func accept(_ connection: NWConnection) {
    guard connections.count < 16, case let .hostPort(remote, _) = connection.endpoint, Self.privateAddress(String(describing: remote)) else { connection.cancel(); return }
    let id = UUID().uuidString
    connections[id] = connection
    connection.start(queue: queue)
    queue.asyncAfter(deadline: .now() + 5) { if !self.responding.contains(id) { self.finish(id) } }
    // Outlasts the TV's 110s operation deadline; uploads still get only 5s.
    queue.asyncAfter(deadline: .now() + 120) { self.finish(id) }
    receive(id, Data())
  }
  private func finish(_ id: String) { connections.removeValue(forKey: id)?.cancel(); responding.remove(id) }
  private func receive(_ id: String, _ previous: Data) {
    guard let connection = connections[id] else { return }
    connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, complete, error in
      guard error == nil else { self.finish(id); return }
      var bytes = previous; if let data { bytes.append(data) }
      guard bytes.count <= 40960 else { self.finish(id); return }
      guard let delimiter = bytes.range(of: Data("\r\n\r\n".utf8)) else {
        if bytes.count > 8192 || complete { self.finish(id) } else { self.receive(id, bytes) }; return
      }
      guard delimiter.lowerBound <= 8192, let head = String(data: bytes[..<delimiter.lowerBound], encoding: .utf8) else { self.finish(id); return }
      let lines = head.components(separatedBy: "\r\n")
      let first = lines[0].components(separatedBy: " ")
      guard first.count == 3, ["GET", "POST", "OPTIONS"].contains(first[0]), first[2] == "HTTP/1.1", first[1].hasPrefix("/"), !first[1].contains("?"), !first[1].contains("#") else { self.finish(id); return }
      var headers: [String: String] = [:]
      for line in lines.dropFirst() {
        guard let colon = line.firstIndex(of: ":") else { self.finish(id); return }
        let key = line[..<colon].lowercased()
        guard headers[key] == nil else { self.finish(id); return }
        headers[key] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      }
      guard headers["host"] == "\(self.host):8095", headers["transfer-encoding"] == nil else { self.finish(id); return }
      let size = headers["content-length"] ?? "0"
      guard let length = Int(size), String(length) == size, (0...32768).contains(length), first[0] != "POST" || headers["content-type"]?.lowercased() == "application/json" else { self.finish(id); return }
      let body = bytes[delimiter.upperBound...]
      if body.count < length && !complete { self.receive(id, bytes); return }
      guard body.count == length, let text = String(data: body, encoding: .utf8) else { self.finish(id); return }
      self.responding.insert(id)
      if first[0] == "OPTIONS" { self.respond(id, 200, "{}"); return }
      guard first[1] == "/.well-known/mosaicast-peer" || first[1].hasPrefix("/peer/") else { self.respond(id, 404, "{}"); return }
      self.request?(id, first[0], first[1], text)
    }
  }
  func respond(_ id: String, _ status: Int, _ body: String) {
    queue.async {
      guard let connection = self.connections[id], body.utf8.count <= 600000 else { self.finish(id); return }
      let payload = Data(body.utf8)
      let header = "HTTP/1.1 \(status == 200 ? "200 OK" : "400 Bad Request")\r\nContent-Type: application/json\r\nContent-Length: \(payload.count)\r\nConnection: close\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n"
      connection.send(content: Data(header.utf8) + payload, completion: .contentProcessed { _ in self.finish(id) })
    }
  }
}
