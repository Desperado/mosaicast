Pod::Spec.new do |s|
  s.name = 'MosaicastPeer'
  s.version = '0.1.0'
  s.summary = 'Foreground local peer transport'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'Mosaicast contributors'
  s.homepage = 'https://github.com/Desperado/mosaicast'
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
