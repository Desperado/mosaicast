const { build } = require('esbuild');
const path = require('node:path');

// Exercise the real screen and scroll layout. Only native boundaries and the
// connection service are replaced; invitations never leave this test page.
exports.companionHarness = async () => {
  const root = path.resolve(__dirname, '../../..');
  const stubs = {
    'react-native': `export * from 'react-native-web'; import {Platform as WebPlatform, View} from 'react-native-web'; export const Platform = {...WebPlatform, OS: 'ios'}; export const InputAccessoryView = View;`,
    'react-native-safe-area-context': `export {View as SafeAreaView} from 'react-native-web'; export const useSafeAreaInsets = () => ({top:0,bottom:0,left:0,right:0});`,
    'expo-router': `import {useEffect} from 'react'; export const useFocusEffect = callback => useEffect(callback, [callback]); export const router = {canGoBack:()=>false, replace:()=>{}};`,
    'expo-camera': `export const useCameraPermissions = () => [{granted:true}, async()=>({granted:true})];`,
    '../components/qr-scanner': `import {View} from 'react-native'; export const QRScanner = ({onScan}) => { window.testScan = onScan; return <View style={{height:300}}/>; };`,
    './icon': `export const Icon = () => null;`,
    '../state/app': `import {createContext, useContext, useState} from 'react';
      import {en,uk} from '@mosaicast/i18n'; import {themes} from '@mosaicast/design';
      const Context = createContext(null); export const useApp = () => useContext(Context);
      export function Provider({children}) {
        const [peerStatus,setPeerStatus] = useState({connected:true});
        const text = window.testLanguage === 'uk' ? uk : en;
        const connectCompanion = async () => { window.connectCalls = (window.connectCalls || 0) + 1;
          return new Promise(resolve => { window.finishConnection = success => {
            setPeerStatus(success ? {qr:true,expires:Date.now()+300000} : {failure:'receiver'}); resolve(success);
          }; }); };
        window.finishPairing = () => setPeerStatus({connected:true});
        return <Context.Provider value={{t:key=>text[key],colors:themes.dark,ready:true,real:true,
          deviceState:{busy:false,host:'192.168.1.20'},preferences:{address:'192.168.1.20'},peerStatus,
          connectCompanion,cancelPeer:()=>{},approvePeer:()=>{},takePeerControl:()=>{},refresh:async()=>{}}}>{children}</Context.Provider>;
      }`,
  };
  const result = await build({
    stdin: {contents: `import {createRoot} from 'react-dom/client';
      import Companion from './apps/mobile/src/app/companion'; import {Provider} from '../state/app';
      import {createPeerInvitation} from '@mosaicast/musiccast';
      window.scanValid = () => window.testScan(createPeerInvitation(n=>crypto.getRandomValues(new Uint8Array(n)), '192.168.1.20').text);
      createRoot(document.getElementById('root')).render(<Provider><Companion/></Provider>);`, resolveDir: root, loader: 'tsx'},
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: {'process.env.NODE_ENV':'"test"',__DEV__:'false'},
    plugins: [{name:'native-boundaries',setup(builder) {
      builder.onResolve({filter:/.*/}, args => args.path in stubs ? {path:args.path,namespace:'stub'} : undefined);
      builder.onLoad({filter:/.*/,namespace:'stub'}, args => ({contents:stubs[args.path],loader:'tsx',resolveDir:root}));
    }}],
  });
  return result.outputFiles[0].text;
};
