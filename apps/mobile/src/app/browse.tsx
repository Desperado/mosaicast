import { useEffect, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { canBrowseSource, validBrowseAction } from '@mosaicast/musiccast';
import { sourceLabel } from '@mosaicast/i18n';
import { BackHeader, Button, Card, Copy, IconButton, ErrorNotice, Screen, ScrollArea, styles } from '../components/ui';
import { useApp } from '../state/app';

export default function Browse() {
  const { input } = useLocalSearchParams<{ input?: string }>();
  const { activeRoom } = useApp();
  return <Catalog key={`${activeRoom}:${input}`} input={typeof input === 'string' ? input : undefined}/>;
}

function Catalog({ input }: { input?: string }) {
  const focused = usePathname() === '/browse';
  const { t, locale, colors, snapshot, busy, controlsDisabled, commandError, refresh, browseState, loadBrowse, browseAction } = useApp();
  const [searchIndex, setSearchIndex] = useState<number>();
  const [query, setQuery] = useState('');
  const error = commandError ?? browseState.browseError;
  const source = snapshot?.features.sources.find(source => source.id === input && canBrowseSource(source));
  const available = !!source && snapshot?.status.power === 'on';
  useEffect(() => {
    if (input && available) void loadBrowse(input);
  }, [input, available, loadBrowse]);
  const page = browseState.browse?.input === input ? browseState.browse : undefined;
  const disabled = controlsDisabled || !available;
  const searchAction = page && searchIndex !== undefined ? { type: 'search' as const, token: page.token, index: searchIndex, text: query } : undefined;
  function search() {
    if (searchAction && validBrowseAction(searchAction) && !disabled && !busy) { Keyboard.dismiss(); setSearchIndex(undefined); void browseAction(searchAction); }
  }
  return <Screen header={<>
    <BackHeader title={t('browse')}/>
    <View style={styles.spread}><View style={{ flex: 1, minWidth: 0 }}>
      <Copy kind="small" lines={1}>{source ? sourceLabel(locale, source.id, source.name) : t('browseSource')}</Copy>
      <Copy kind="heading" lines={1} accessibilityRole="header">{page?.title || source?.name}</Copy>
    </View><IconButton name="refresh" label={t('refreshMenu')} pending={busy} disabled={disabled} onPress={() => { setSearchIndex(undefined); if (input) void loadBrowse(input); }}/></View>
    {page && page.layer > 0 && <Button label={t('parentMenu')} pending={busy} disabled={disabled} onPress={() => { setSearchIndex(undefined); void browseAction({ type: 'back', token: page.token }); }}/>}
    {focused && error && <ErrorNotice key={error} message={t(error)}>{browseState.browseError === 'companionOwned' && <Button label={t('takeoverMenu')} disabled={busy} onPress={() => { if (input) void loadBrowse(input, 0, true); }}/>}
      {commandError && <Button label={t('refresh')} disabled={busy} onPress={() => void refresh()}/>}</ErrorNotice>}
  </>} footer={page && <View style={styles.smallStack}>
    <Copy kind="small">{page.total ? `${page.index + 1}–${page.index + page.items.length} / ${page.total}` : '0'} {t('items')}</Copy>
    {page.total > 8 && <View style={[styles.row, { gap: 8, alignItems: 'stretch' }]}>
      <View style={{ flex: 1 }}><Button label={t('previousPage')} pending={busy} disabled={disabled || page.index === 0} onPress={() => { setSearchIndex(undefined); if (input) void loadBrowse(input, page.index - 8); }}/></View>
      <View style={{ flex: 1 }}><Button label={t('nextPage')} pending={busy} disabled={disabled || page.index + 8 >= page.total} onPress={() => { setSearchIndex(undefined); if (input) void loadBrowse(input, page.index + 8); }}/></View>
    </View>}
  </View>}>
    {!available && <Copy>{t('browseUnavailable')}</Copy>}
    <ScrollArea resetKey={page ? `${page.input}:${page.layer}:${page.title}:${page.index}` : undefined}>
      {page && !page.items.length && <Copy>{t('browseEmpty')}</Copy>}
      {page?.items.map(item => <View key={`${page.input}:${page.layer}:${page.title}:${item.index}`} style={styles.smallStack}>
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, minWidth: 0 }}><Button label={item.text || t('searchCatalog')}
            icon={!item.selectable && !item.searchable && item.playable ? 'play' : undefined}
            accessibilityLabel={`${t(item.searchable ? 'search' : item.selectable ? 'openFolder' : 'play')}: ${item.text || t('searchCatalog')}`}
            pending={busy} disabled={disabled || !(item.selectable || item.playable || item.searchable)}
            onPress={() => {
              if (item.searchable) { setSearchIndex(item.index); setQuery(''); }
              else void browseAction({ type: item.selectable ? 'select' : 'play', token: page.token, index: item.index });
            }}/></View>
          {item.playable && (item.selectable || item.searchable) && <IconButton name="play" label={`${t('play')}: ${item.text}`} pending={busy} disabled={disabled} onPress={() => void browseAction({ type: 'play', token: page.token, index: item.index })}/>}
        </View>
        {searchIndex === item.index && item.searchable && <Card>
          <Copy kind="small">{t('searchQuery')}</Copy>
          <TextInput accessibilityLabel={t('searchQuery')} value={query} onChangeText={setQuery} maxLength={256} returnKeyType="search" onSubmitEditing={search}
            editable={!disabled && !busy} autoFocus autoCorrect={false} style={{ color: colors.text, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 52, fontSize: 16 }}/>
          <Button label={t('search')} pending={busy} disabled={disabled || !searchAction || !validBrowseAction(searchAction)} onPress={search}/>
        </Card>}
      </View>)}
    </ScrollArea>

  </Screen>;
}
