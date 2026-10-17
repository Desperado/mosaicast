import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type IconName = 'listen' | 'rooms' | 'connection' | 'settings' | 'refresh' | 'power' | 'back' | 'chevron' | 'close' | 'plus' | 'minus' | 'play' | 'pause' | 'previous' | 'next' | 'volume' | 'muted' | 'check' | 'music' | 'radio';

// Original geometric icons; no third-party icon artwork is bundled.
export function Icon({ name, color, size = 22 }: { name: IconName; color: ColorValue; size?: number }) {
  const paths: Partial<Record<IconName, string>> = {
    radio: 'M4 7h16v14H4ZM6 7l12-5M7 11h10M15 15h2m-2 3h2',
    rooms: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', connection: 'M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0Zm6 9v5',
    settings: 'M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-9h6', power: 'M12 2v10M6 5a9 9 0 1 0 12 0',
    back: 'm15 5-7 7 7 7', chevron: 'm8 10 4 4 4-4', close: 'm6 6 12 12M18 6 6 18',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'm5 12 4 4L19 6',
    refresh: 'M20 7v5h-5M20 12a8 8 0 1 0-2 6M20 7v5',
    volume: 'M4 9h4l5-5v16l-5-5H4ZM17 8a7 7 0 0 1 0 8m3-11a11 11 0 0 1 0 14',
    muted: 'M4 9h4l5-5v16l-5-5H4Zm13 1 5 5m0-5-5 5', music: 'M9 18V5l11-2v13M9 8l11-2',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {name === 'listen' ? <><Circle cx={12} cy={12} r={9}/><Circle cx={12} cy={12} r={3}/></>
      : name === 'play' ? <Path d="m8 4 12 8-12 8Z" fill={color} strokeWidth={0}/>
      : name === 'pause' ? <><Rect x={6} y={4} width={4} height={16} rx={1} fill={color} strokeWidth={0}/><Rect x={14} y={4} width={4} height={16} rx={1} fill={color} strokeWidth={0}/></>
      : name === 'previous' || name === 'next' ? <Path d={name === 'next' ? 'M5 5 16 12 5 19ZM19 5v14' : 'M19 5 8 12l11 7ZM5 5v14'} fill={color}/>
      : <><Path d={paths[name]}/>{name === 'radio' && <Circle cx={9} cy={16} r={2}/>}
      {name === 'music' && <><Circle cx={6} cy={18} r={3}/><Circle cx={17} cy={16} r={3}/></>}</>}
  </Svg>;
}
