'use client';
import type {ReactNode} from 'react';
import {useLocale} from './locale-provider';
import {localizeTree} from '../lib/i18n/react-tree';
export default function LocalizedContent({children}:{children:ReactNode}){const {locale}=useLocale();return localizeTree(children,locale);}
