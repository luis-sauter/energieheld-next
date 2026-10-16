'use client';
import {useState} from 'react';
import type {TravelReviewSnapshot,TravelSaveResult} from '@/lib/admin-travel-taxonomy';
import {TravelReviewProvider} from './travel-review-context';
import {TravelTaxonomyEditor} from './travel-taxonomy-editor';
import {clearAccommodationFacets} from '@/components/portal/use-accommodation-facets';
import styles from './admin.module.css';
export function BasicCategoryEditor({snapshot,saveAction}:{snapshot:TravelReviewSnapshot;saveAction:(selected:string[],revision:number,reason:string)=>Promise<TravelSaveResult>}){
  const [reason,setReason]=useState('');
  return <TravelReviewProvider snapshot={snapshot} saveAction={async(selected,_expected,_proposals,revision)=>{const result=await saveAction(selected,revision,reason);if(result.success)clearAccommodationFacets();return result;}}>
    <p>Diese Auswahl steuert ausschließlich die normale Suche und Unterkünfte A–Z. Sie veröffentlicht keine Unterkunft und erzeugt keine Mottoreisen- oder Sliderplatzierung.</p>
    <div className={styles.travelFilters}><label>Begründung der Änderung<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} required/></label></div>
    <TravelTaxonomyEditor compact basic/>
  </TravelReviewProvider>;
}
