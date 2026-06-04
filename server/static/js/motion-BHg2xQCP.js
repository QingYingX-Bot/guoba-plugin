import{zt as e}from"./useConfigInject-CnflYmPm.js";var t=!1;try{let e=Object.defineProperty({},`passive`,{get(){t=!0}});window.addEventListener(`testPassive`,null,e),window.removeEventListener(`testPassive`,null,e)}catch(e){}var n=t;function r(e,t,r,i){if(e&&e.addEventListener){let a=i;a===void 0&&n&&(t===`touchstart`||t===`touchmove`||t===`wheel`)&&(a={passive:!1}),e.addEventListener(t,r,a)}return{remove:()=>{e&&e.removeEventListener&&e.removeEventListener(t,r)}}}var i=e=>({animationDuration:e,animationFillMode:`both`}),a=e=>({animationDuration:e,animationFillMode:`both`}),o=function(t,n,r,o){let s=arguments.length>4&&arguments[4]!==void 0&&arguments[4]?`&`:``;return{[`
      ${s}${t}-enter,
      ${s}${t}-appear
    `]:e(e({},i(o)),{animationPlayState:`paused`}),[`${s}${t}-leave`]:e(e({},a(o)),{animationPlayState:`paused`}),[`
      ${s}${t}-enter${t}-enter-active,
      ${s}${t}-appear${t}-appear-active
    `]:{animationName:n,animationPlayState:`running`},[`${s}${t}-leave${t}-leave-active`]:{animationName:r,animationPlayState:`running`,pointerEvents:`none`}}};export{r as n,n as r,o as t};