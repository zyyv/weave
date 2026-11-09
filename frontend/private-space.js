import {t} from './i18n.js';
import {mountPinInput} from './pin-input.js';

export function createPrivateSpace({dialog, api}) {
 const form = dialog.querySelector('form');
 const fields = dialog.querySelector('.pin-fields');
 const title = dialog.querySelector('h2');
 const subtitle = dialog.querySelector('.feature-subtitle');
 const help = dialog.querySelector('#pinHint');
 const error = dialog.querySelector('.pin-error');
 const submit = form.querySelector('button[type=submit]');
 let resolvePrompt, pending = false;

 dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
 dialog.addEventListener('close', () => {
  fields.replaceChildren();
  resolvePrompt?.(false);
  resolvePrompt = null;
 });
 dialog.querySelectorAll('[data-pin-cancel]').forEach(button => button.onclick = () => {
  if (!pending) dialog.close();
 });
 function request(root, name, create) {
  if (dialog.open) return Promise.resolve(false);
  title.textContent = t(create ? 'privateSetup' : 'privateUnlock');
  subtitle.textContent = name;
  help.textContent = t(create ? 'privateSetupHint' : 'privatePinHint');
  error.textContent = '';
  submit.textContent = t(create ? 'privateCreate' : 'privateUnlockAction');
  const pin = mountPinInput(fields, {id: 'vaultPin', label: t('privatePIN'), describedBy: 'pinHint pinError', autocomplete: create ? 'new-password' : 'current-password'});
  const confirm = create ? mountPinInput(fields, {id: 'vaultConfirm', label: t('privateConfirmPIN'), describedBy: 'pinHint pinError', autocomplete: 'new-password'}) : null;
  form.onsubmit = async event => {
   event.preventDefault();
   if (pending) return;
   error.textContent = '';
   pin.removeAttribute('aria-invalid');
   confirm?.removeAttribute('aria-invalid');
   if (confirm && pin.value !== confirm.value) {
    error.textContent = t('privateMismatch');
    confirm.setAttribute('aria-invalid', 'true');
    confirm.focus();
    confirm.select();
    return;
   }
   pending = true;
   submit.disabled = true;
   try {
    await api('vault-unlock', {root, pin: pin.value, create});
    resolvePrompt?.(true);
    resolvePrompt = null;
    dialog.close();
   } catch (err) {
    error.textContent = err.message;
    pin.setAttribute('aria-invalid', 'true');
    pin.focus();
    pin.select();
   } finally {
    pending = false;
    submit.disabled = false;
   }
  };
  dialog.showModal();
  pin.focus();
  return new Promise(resolve => { resolvePrompt = resolve; });
 }
 return {request};
}
