'use client';
import {useId} from 'react';

export default function CyberSpider({active=false,stage=0}:{active?:boolean;stage?:number}){
  const id=useId().replace(/:/g,'');
  return <svg className={`cyber-pet ${active?'awake':'sleeping'} phase-${stage}`} viewBox="0 0 460 370" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-shell`} x1="170" y1="80" x2="300" y2="285" gradientUnits="userSpaceOnUse"><stop stopColor="#f0dcff"/><stop offset=".24" stopColor="#9786c9"/><stop offset=".5" stopColor="#211735"/><stop offset=".72" stopColor="#756398"/><stop offset="1" stopColor="#171020"/></linearGradient><linearGradient id={`${id}-leg`} x1="100" y1="100" x2="320" y2="260" gradientUnits="userSpaceOnUse"><stop stopColor="#d9befb"/><stop offset=".45" stopColor="#9681bb"/><stop offset="1" stopColor="#432d62"/></linearGradient><radialGradient id={`${id}-core`}><stop stopColor="#fff"/><stop offset=".2" stopColor="#dfbcff"/><stop offset=".65" stopColor="#ae76fa"/><stop offset="1" stopColor="#4c256f"/></radialGradient><radialGradient id={`${id}-floor`}><stop stopColor="#ba84ff" stopOpacity=".33"/><stop offset="1" stopColor="#9053ee" stopOpacity="0"/></radialGradient><filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <ellipse cx="230" cy="309" rx="160" ry="37" fill={`url(#${id}-floor)`}/><ellipse className="pet-pad" cx="230" cy="302" rx="123" ry="24" stroke="#b48cff" strokeOpacity=".35"/><ellipse cx="230" cy="302" rx="90" ry="17" stroke="#b48cff" strokeOpacity=".17"/>
    <g className="pet-body">
      {[false,true].map(mirror=><g key={String(mirror)} transform={mirror?'translate(460 0) scale(-1 1)':undefined}>
        <g className="pet-leg leg-one"><path d="M207 147L159 110L100 110L56 72" stroke="#2b203c" strokeWidth="13" strokeLinejoin="round"/><path d="M207 144L159 107L100 107L56 69" stroke={`url(#${id}-leg)`} strokeWidth="6" strokeLinejoin="round"/><circle cx="159" cy="108" r="6" fill="#352346" stroke="#ac8ad3" strokeWidth="2"/><path d="M100 107L77 88" stroke="#e7ceff" strokeWidth="2"/></g>
        <g className="pet-leg leg-two"><path d="M200 171L144 151L85 171L31 154" stroke="#24192f" strokeWidth="13" strokeLinejoin="round"/><path d="M200 167L144 147L85 167L31 150" stroke={`url(#${id}-leg)`} strokeWidth="6" strokeLinejoin="round"/><circle cx="144" cy="148" r="6" fill="#352346" stroke="#ac8ad3" strokeWidth="2"/><path d="M83 167L53 158" stroke="#e7ceff" strokeWidth="2"/></g>
        <g className="pet-leg leg-three"><path d="M201 198L148 202L97 243L44 246" stroke="#22182d" strokeWidth="13" strokeLinejoin="round"/><path d="M201 194L148 198L97 239L44 242" stroke={`url(#${id}-leg)`} strokeWidth="6" strokeLinejoin="round"/><circle cx="148" cy="199" r="6" fill="#352346" stroke="#ac8ad3" strokeWidth="2"/><path d="M96 239L67 241" stroke="#e7ceff" strokeWidth="2"/></g>
        <g className="pet-leg leg-four"><path d="M212 217L176 250L156 302L121 321" stroke="#24192f" strokeWidth="13" strokeLinejoin="round"/><path d="M212 213L176 246L156 298L121 317" stroke={`url(#${id}-leg)`} strokeWidth="6" strokeLinejoin="round"/><circle cx="176" cy="247" r="6" fill="#352346" stroke="#ac8ad3" strokeWidth="2"/><path d="M156 298L138 308" stroke="#e7ceff" strokeWidth="2"/></g>
      </g>)}
      <path d="M189 126C190 94 205 75 230 75C255 75 270 94 271 126L261 188C257 210 245 223 230 223C215 223 203 210 199 188Z" fill={`url(#${id}-shell)`} stroke="#c9a4ee" strokeOpacity=".7" strokeWidth="1.5"/>
      <path d="M205 101Q230 84 255 101L248 160Q230 180 212 160Z" fill="#1c132a" stroke="#c5a0f4" strokeOpacity=".4"/>
      <path d="M230 96L230 163M213 112L247 112M214 126L246 126M218 140L242 140" stroke="#bd8cff" strokeOpacity=".3"/>
      <ellipse className="pet-core-glow" cx="230" cy="132" rx="14" ry="22" fill="#c49bff" filter={`url(#${id}-glow)`}/><path d="M230 111L240 131L230 153L220 131Z" fill={`url(#${id}-core)`}/>
      <path d="M198 183Q230 166 262 183L269 209Q268 234 250 251L230 264L210 251Q192 234 191 209Z" fill={`url(#${id}-shell)`} stroke="#d1aff3" strokeOpacity=".6"/>
      <path d="M201 201Q230 185 259 201L255 221Q230 238 205 221Z" fill="#110b1c" stroke="#c195ed" strokeOpacity=".3"/>
      <g className="pet-eyes"><ellipse cx="217" cy="208" rx="5" ry="7" fill="#e2bdff"/><ellipse cx="243" cy="208" rx="5" ry="7" fill="#e2bdff"/><ellipse cx="217" cy="208" rx="7" ry="9" fill="#cc8bff" opacity=".5" filter={`url(#${id}-glow)`}/><ellipse cx="243" cy="208" rx="7" ry="9" fill="#cc8bff" opacity=".5" filter={`url(#${id}-glow)`}/></g>
      <path d="M219 240L211 253L219 266M241 240L249 253L241 266" stroke="#c4a0e3" strokeWidth="4" strokeLinecap="round"/>
      <path d="M198 107Q201 87 216 81" stroke="#fff2ff" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round"/>
    </g>
  </svg>;
}
