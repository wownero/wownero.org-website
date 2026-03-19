async function translate(lang) {
    if (lang == 'en-US' || lang == 'en') {
        localStorage.removeItem('wowLang');
        location.reload();
        return;
    }
    if (lang == "it" || lang == "it-CH") lang = "it-IT";
    if (lang == "pt") lang = "pt-BR";
    localStorage.setItem('wowLang', lang);
    var ids = [];
    ids = Array.from(document.querySelectorAll('[id]'));
    var ids_arr = Array.prototype.map.call(ids, (element, i)=>{return element.id});
    var response = await fetch(`js/translations/${lang}.json`);
    response = await response.json();

    for (i = 0; i < ids_arr.length; i++) getTranslation(response, ids_arr[i]);
};

async function getTranslation(data, keys) {
    if (data[keys] === undefined) return;
    document.getElementById(keys).textContent = JSON.stringify(data[keys]).replace(/["]+/g, '');
};
