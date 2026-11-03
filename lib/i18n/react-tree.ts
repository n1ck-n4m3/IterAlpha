import {Children,cloneElement,isValidElement,type ReactElement,type ReactNode} from 'react';
import type {Locale} from '../locale-copy.ts';
import {localizeText} from './text.ts';
const attributes=['aria-label','aria-description','aria-valuetext','title','placeholder','alt'] as const;
/** Keep handlers, values, IDs and exported data untouched; translate React display nodes before rendering. */
export function localizeTree(node:ReactNode,locale:Locale):ReactNode {
  if(typeof node==='string')return localizeText(locale,node);
  if(Array.isArray(node))return Children.map(node,child=>localizeTree(child,locale));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>,props=element.props;
  if(typeof element.type==='string'&&['pre','code','script','style'].includes(element.type))return node;
  const changes:Record<string,unknown>={};
  if(typeof element.type==='string')for(const key of attributes)if(typeof props[key]==='string')changes[key]=localizeText(locale,props[key] as string);
  if('children' in props&&props['data-i18n']!=='source')changes.children=localizeTree(props.children as ReactNode,locale);
  return cloneElement(element,changes);
}
