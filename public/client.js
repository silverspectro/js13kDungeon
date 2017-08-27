"use strict";!function(){function e(e,t,n){return e.addEventListener(t,n)}function t(e){return document.getElementById(e)}function n(e){for(;e.children.length;)e.removeChild(e.children[e.children.length-1])}function i(e,t){g[e.id]=e.className.includes("off"),g[e.id]&&!t?e.classList.remove("off"):e.classList.add("off")}function o(){Array.prototype.slice.apply(y.children).forEach(function(e){e.getAttribute("data-game-id")===f?e.classList.add("selected"):e.classList.remove("selected")})}function a(e){f=e.target.getAttribute("data-game-id"),o()}function d(t){n(y),t.forEach(function(t){var n=document.createElement("li");n.setAttribute("data-game-id",t.id),n.innerHTML="id: "+t.id+"<br>players: "+t.dungeons.length,e(n,"click",a),y.appendChild(n)})}function r(){Array.prototype.slice.apply(L.getElementsByTagName("button")).forEach(function(e){var t=e.getAttribute("data-option-index");parseInt(t,10)===parseInt(w,10)?e.classList.add("selected"):e.classList.remove("selected")}),m.selectedOption=m.options[w]}function c(e){var t=e.target.getAttribute("data-option-index");w=t,r()}function s(e){n(L),e.forEach(function(e,t){var n=createUIElement("li"),i=createUIElement("button",{"data-option-index":t},{click:c});i.innerHTML=e,n.appendChild(i),L.appendChild(n)}),void 0===w&&(w=0),r()}function l(){p.on("room-list",function(e){d(e),i(h),i(v)}),p.on("game-created",function(e){m=new Game(p,!1),m.updateGame(e),s(m.options),i(v),E.classList.remove("off")}),p.on("update",function(e){m||(m=new Game(p,!1)),m.updateGame(e),i(v,!0),i(h,!0),m.options.length&&s(m.options),E.classList.remove("off")}),p.on("error",function(){}),Array.prototype.slice.apply(document.getElementsByTagName("button")).forEach(function(t){e(t,"click",function(){switch(t.id){case"join-game":p.emit(t.id,f);break;default:p.emit(t.id,p.id)}})}),window.addEventListener("mousemove",function(e){b=e.screenX,A=e.screenY}),window.addEventListener("contextmenu",function(e){if(e.preventDefault(),e.stopPropagation(),i(E),g[E.id]){var t=b,n=A;E.style.left=t+"px",E.style.top=n+"px"}}),window.addEventListener("keyup",function(e){var t,n=e.keyCode;m&&(87===n||38===n?t="up":40===n||83===n?t="down":65===n||37===n?t="left":68!==n&&39!==n||(t="right"),t&&p.emit("move-player",t))})}function u(){p=io({upgrade:!1,transports:["websocket"]}),l()}var f,p,m,g={},v=t("start-menu"),h=t("games-menu"),y=t("games-list"),E=t("option-list"),L=E.getElementsByTagName("ul")[0],w=0,b=0,A=0;window.addEventListener("load",u,!1)}();