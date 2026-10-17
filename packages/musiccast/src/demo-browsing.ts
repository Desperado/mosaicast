import { BrowseError, canBrowseSource, validBrowseAction, validBrowseIndex } from './browsing';
import type { BrowsePage, Controller, Snapshot } from './types';

// Fictional catalog, kept entirely outside the device adapter.
const titles = ['A slower kind of Sunday', 'Light through the window', 'The blue hour', 'Small hours', 'Along the coast', 'First light', 'A room in spring', 'Quiet water', 'Autumn colours', 'Far from shore', 'Last light'];

export function demoBrowsing(read: () => Snapshot, play: (input: string, title: string) => Snapshot): Pick<Controller, 'browse' | 'browseAction'> {
  let page: BrowsePage | undefined;
  let input = '', layer = 0, query = '', revision = 0;
  function list(index: number): BrowsePage {
    const all = layer === 0
      ? [{ text: 'Low tide hours', selectable: true, playable: false, searchable: false }, { text: '', selectable: true, playable: false, searchable: true }]
      : titles.filter(title => !query || title.toLowerCase().includes(query.toLowerCase())).map(text => ({ text, selectable: false, playable: true, searchable: false }));
    page = { input, token: String(++revision), layer, title: layer === 0 ? read().features.sources.find(source => source.id === input)!.name : query || 'Low tide hours', index, total: all.length,
      items: all.slice(index, index + 8).map((item, offset) => ({ ...item, index: index + offset })) };
    return { ...page, items: page.items.map(item => ({ ...item })) };
  }
  return {
    async browse(nextInput, index = 0) {
      const snapshot = read();
      if (!validBrowseIndex(index) || snapshot.status.power !== 'on' || !snapshot.features.sources.some(source => source.id === nextInput && canBrowseSource(source))) throw new BrowseError('browseUnavailable');
      if (nextInput !== input) { input = nextInput; layer = 0; query = ''; }
      return list(index);
    },
    async browseAction(action) {
      if (!validBrowseAction(action) || !page || action.token !== page.token || read().status.power !== 'on') throw new BrowseError('browseChanged');
      const item = action.type === 'back' ? undefined : page.items.find(item => item.index === action.index);
      if (action.type === 'back') {
        if (!layer) throw new BrowseError('browseChanged');
        layer = 0; query = '';
      } else if (action.type === 'play' && item?.playable) {
        const snapshot = play(input, item.text);
        return { page: list(page.index), snapshot };
      } else if ((action.type === 'select' && item?.selectable && !item.searchable) || (action.type === 'search' && item?.searchable)) {
        layer = 1; query = action.type === 'search' ? action.text.trim() : '';
      } else throw new BrowseError('browseChanged');
      return { page: list(0) };
    },
  };
}
