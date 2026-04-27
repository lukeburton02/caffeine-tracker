export function showToast(message) {
    const toast = document.getElementById('preset-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
}
