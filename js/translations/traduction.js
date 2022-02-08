async function translate(lang) {
    if (lang == 'en-US') { return };
    var ids = [];
    ids = Array.from(document.querySelectorAll('[id]'));
    var ids_arr = Array.prototype.map.call(ids, function (element, i) {
        return element.id;
    });
    for (i = 0; i < ids_arr.length; i++) {
        fetchData(ids_arr[i], lang);
    }
};

async function fetchData(id, lang) {
    var response = await fetch(`js/translations/${lang}.json`);
    response = await response.json();
    getTranslation(response, id);
};

async function getTranslation(data, keys) {
    document.getElementById(keys).textContent = JSON.stringify(data[keys]).replace(/["]+/g, '');
};

// console errors are stupid, my code works fine (its late @ night :/)