import {t} from './i18n.js';

const languages={
 '.js':'javascript','.mjs':'javascript','.cjs':'javascript','.jsx':'jsx',
 '.ts':'typescript','.mts':'typescript','.cts':'typescript','.tsx':'tsx',
 '.html':'markup','.htm':'markup','.xml':'markup','.svg':'markup','.vue':'markup',
 '.css':'css','.scss':'scss','.less':'less',
 '.json':'json','.jsonc':'json','.json5':'json5','.yaml':'yaml','.yml':'yaml',
 '.toml':'toml','.graphql':'graphql','.gql':'graphql','.mdx':'markdown'
};
export const codeLanguage=extension=>languages[extension];

async function formatSource(item,source,signal){
 const response=await fetch('format?id='+encodeURIComponent(item.id),{method:'POST',body:source,signal});
 if(!response.ok){
  const message=response.status===422?t('couldNotFormatCode'):
   response.status===503?t('codeFormatterUnavailable'):t('codeFormatterFailed');
  throw Error(message);
 }
 return response.text();
}

function appendTokens(target,tokens){
 for(const token of tokens){
  if(typeof token==='string'){
   target.append(token);
   continue;
  }
  const span=document.createElement('span');
  span.className='token '+token.type;
  if(token.alias)span.classList.add(...[].concat(token.alias));
  appendTokens(span,[].concat(token.content));
  target.append(span);
 }
}

export async function mountCodePreview(root,item,source,{language,truncated,canFormat,signal}){
 let prism;
 try{prism=(await import('./vendor/prism/prism.mjs')).default}catch{}
 if(signal.aborted)return;

 const viewer=document.createElement('div');
 viewer.className='code-preview';
 const toolbar=document.createElement('div');
 toolbar.className='code-toolbar';
 const extension=document.createElement('strong');
 extension.textContent=item.ext.slice(1).toUpperCase();
 toolbar.append(extension);
 const status=document.createElement('p');
 status.className='code-status';
 status.setAttribute('role','status');
 status.hidden=true;
 const surface=document.createElement('div');
 surface.className='code-surface';
 surface.tabIndex=0;
 surface.setAttribute('aria-label',item.name);
 const pre=document.createElement('pre');
 const code=document.createElement('code');
 pre.append(code);
 surface.append(pre);

 function display(text){
  const grammar=prism?.languages[language];
  if(grammar){
   try{
    const fragment=document.createDocumentFragment();
    appendTokens(fragment,prism.tokenize(text,grammar));
    code.replaceChildren(fragment);
    return;
   }catch{}
  }
  code.textContent=text;
 }
 display(source);
 if(canFormat){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=t('formatCodePreview');
  button.disabled=truncated;
  if(truncated)button.title=t('formatRequiresCompleteFile');
  let formatted=false;
  button.onclick=async()=>{
   button.disabled=true;
   status.hidden=true;
   try{
    const text=formatted?source:await formatSource(item,source,signal);
    if(signal.aborted)return;
    display(text);
    formatted=!formatted;
    button.textContent=formatted?t('showOriginalCode'):t('formatCodePreview');
    surface.scrollTo(0,0);
   }catch(error){
    if(signal.aborted)return;
    status.textContent=error instanceof TypeError?t('codeFormatterFailed'):error.message;
    status.hidden=false;
   }finally{button.disabled=false}
  };
  toolbar.append(button);
 }
 viewer.append(toolbar,status,surface);
 root.replaceChildren(viewer);
}
