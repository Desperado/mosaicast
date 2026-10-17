// Example menus/track titles only. This transport never contacts a device.
export function demoTransport() {
  let layer = 0, menu = 'Deezer', playback = 'pause', track = 'A slower kind of Sunday', volume = 12, mute = false, power = 'on', input = 'deezer', browsingInput = 'deezer';
  const inputs = ['napster', 'spotify', 'juke', 'qobuz', 'tidal', 'deezer', 'airplay', 'mc_link', 'server', 'net_radio', 'bluetooth', 'usb', 'tuner', 'cd', 'digital', 'aux'];
  const deezerRoot = ['Flow', 'Charts', 'Recommendations', 'Mixes', 'Genres', 'My library', 'Search'];
  const root = () => browsingInput === 'deezer' ? deezerRoot : ['Example collection', 'Example track'];
  return async (_host, route, params) => {
    if (route === 'system/getDeviceInfo') return { response_code: 0, model_name: 'Demo Yamaha' };
    if (route === 'system/getFeatures') return { response_code: 0, system: { func_list: ['wired_lan', 'wireless_lan', 'wireless_direct', 'network_standby', 'auto_power_standby', 'bluetooth_tx_setting', 'airplay'], input_list: inputs.map(id => ({id, play_info_type: id === 'tuner' ? 'tuner' : id === 'cd' ? 'cd' : ['digital', 'aux'].includes(id) ? 'none' : 'netusb'})) }, zone: [{ id: 'main', func_list: ['power', 'sleep', 'prepare_input_change', 'volume', 'mute', 'link_control', 'link_audio_quality'], input_list: inputs, range_step: [{ id: 'volume', min: 0, max: 63, step: 1 }] }], netusb: {func_list: ['recent_info', 'play_queue', 'mc_playlist']}, tuner: {func_list: ['fm', 'dab']}, distribution: {version: 2, client_max: 9} };
    if (route === 'main/getStatus') return { response_code: 0, power, input, volume, max_volume: 63, mute };
    if (route === 'main/setPower') { power = params.power; if (power === 'standby') playback = 'stop'; }
    if (route === 'main/setInput') input = params.input;
    if (route === 'main/setVolume') volume = Math.max(0, Math.min(63, volume + (params.volume === 'up' ? 1 : -1)));
    if (route === 'main/setMute') mute = params.enable;
    if (route === 'netusb/getPlayInfo') return { response_code: 0, input, playback, track, artist: 'The Quiet Hours', album: 'Example music' };
    if (route === 'netusb/getListInfo') {
      if (browsingInput !== params.input) { browsingInput = params.input; layer = 0; }
      return { response_code: 0, input: params.input, menu_layer: layer, index: 0, max_line: layer ? 4 : root().length, menu_name: layer ? menu : params.input === 'deezer' ? 'Deezer' : params.input.replaceAll('_', ' '), list_info: (layer ? ['A slower kind of Sunday', 'Light through the window', 'Somewhere in the garden', 'After the rain'] : root()).map((text, i) => ({ text, attribute: layer ? 4 : browsingInput === 'deezer' ? (i === 0 ? 4 : i === 6 ? 10 : 2) : i === 0 ? 2 : 4 })) };
    }
    if (route === 'netusb/setListControl') {
      if (params.type === 'return') { layer = 0; menu = 'Deezer'; }
      else if (params.type === 'select') { layer = 1; menu = root()[params.index]; }
      else { input = browsingInput; playback = 'play'; track = layer ? ['A slower kind of Sunday', 'Light through the window', 'Somewhere in the garden', 'After the rain'][params.index] : 'A slower kind of Sunday'; }
    }
    if (route === 'netusb/setSearchString') { layer = 1; menu = `Example results for “${params.string}”`; }
    if (route === 'netusb/setPlayback') playback = params.playback === 'play_pause' ? (playback === 'play' ? 'pause' : 'play') : params.playback === 'pause' || params.playback === 'stop' ? params.playback : 'play';
    return { response_code: 0 };
  };
}
