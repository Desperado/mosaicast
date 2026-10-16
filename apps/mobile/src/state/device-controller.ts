import { MusicCastClient } from '@mosaicast/musiccast';
export const deviceController = (host: string) => new MusicCastClient(host);
