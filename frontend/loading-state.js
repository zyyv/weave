export function loadingMark() {
 const template=document.createElement('template');
 template.innerHTML=`<svg class="loading-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
 <path class="loading-track" d="M21 18a10 10 0 0 1 14 0l11 11a10 10 0 0 1 0 14l-3 3M43 46a10 10 0 0 1-14 0L18 35a10 10 0 0 1 0-14l3-3"/>
 <path class="loading-strand" d="M14 31 31 14a9 9 0 0 1 13 13L27 44a9 9 0 0 1-13-13Z"/>
 <path class="loading-strand" d="m20 37 17-17a9 9 0 0 1 13 13L33 50a9 9 0 0 1-13-13Z"/>
 </svg>`;
 return template.content.firstElementChild;
}

export function previewLoading(label, name) {
 const status=document.createElement('div');
 status.className='preview-loading';
 status.setAttribute('role','status');
 const title=document.createElement('strong');
 title.textContent=label;
 const filename=document.createElement('span');
 filename.textContent=name;
 status.append(loadingMark(),title,filename);
 return status;
}
