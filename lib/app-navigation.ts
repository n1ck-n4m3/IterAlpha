export type AppView = 'spider' | 'train' | 'market' | 'review' | 'progress';
export function readAppRoute(search: string) {
  const params = new URLSearchParams(search), candidate = params.get('view');
  const view: AppView = candidate === 'train' || candidate === 'spider' || candidate === 'market' || candidate === 'review' || candidate === 'progress' ? candidate : 'spider';
  return {view, configure: params.get('configure') === '1', track: params.get('track') === 'advanced' ? 'advanced' as const : 'foundations' as const};
}
export function appRoute(search: string, view: AppView, configure = false) {
  const params = new URLSearchParams(search); params.set('view', view);
  if (view === 'train' && configure) params.set('configure', '1'); else params.delete('configure');
  return `/app?${params.toString()}`;
}
