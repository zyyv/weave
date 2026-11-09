// One real input keeps paste, password managers, keyboard and screen readers working.
export function mountPinInput(root, {id, label, describedBy, autocomplete}) {
 const field = document.createElement('div');
 field.className = 'pin-field';
 const caption = document.createElement('label');
 caption.htmlFor = id;
 caption.textContent = label;
 const control = document.createElement('div');
 control.className = 'pin-control';
 const input = document.createElement('input');
 Object.assign(input, {id, type: 'password', inputMode: 'numeric', autocomplete, required: true, pattern: '[0-9]{6}'});
 input.setAttribute('aria-describedby', describedBy);
 const slots = Array.from({length: 6}, () => document.createElement('span'));
 slots.forEach(slot => slot.setAttribute('aria-hidden', 'true'));
 function render() {
  input.value = input.value.replace(/\D/g, '').slice(0, slots.length);
  const cursor = Math.min(input.selectionStart ?? input.value.length, slots.length - 1);
  slots.forEach((slot, index) => {
   slot.textContent = index < input.value.length ? '●' : '';
   slot.classList.toggle('pin-cursor', index === cursor);
  });
 }
 input.addEventListener('input', render);
 input.addEventListener('focus', render);
 input.addEventListener('keyup', render);
 input.addEventListener('click', render);
 control.append(input, ...slots);
 field.append(caption, control);
 root.append(field);
 render();
 return input;
}
