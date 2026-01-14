document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnUpload = document.getElementById('btn-upload');
    const fileInput = document.getElementById('master-file');
    const masterPaste = document.getElementById('master-paste');
    const btnSaveMaster = document.getElementById('btn-save-master');
    const masterStatus = document.getElementById('master-status');
    const skuInput = document.getElementById('sku-input');
    const btnConvert = document.getElementById('btn-convert');
    const btnManual = document.getElementById('btn-manual');
    const resultsSection = document.getElementById('results-section');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const missedSkusTextarea = document.getElementById('missed-skus');

    const btnCopyAsin = document.getElementById('btn-copy-asin');
    const btnCopyFull = document.getElementById('btn-copy-full');
    const btnCopyMissed = document.getElementById('btn-copy-missed');

    // State
    let masterData = {}; // Key: SKU, Value: [{asin, name}, ...]

    // Initialize
    loadMasterFromStorage();

    // Event Listeners
    btnUpload.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            masterPaste.value = event.target.result;
            showToast('ファイルを読み込みました。保存ボタンを押してください。');
        };
        reader.readAsText(file);
    });

    btnSaveMaster.addEventListener('click', () => {
        const rawData = masterPaste.value.trim();
        if (!rawData) {
            showToast('データを入力または貼り付けてください。', 'error');
            return;
        }

        const parsed = parseMasterData(rawData);
        if (Object.keys(parsed).length === 0) {
            showToast('有効な列名（出品者SKU, ASIN 1）が見つかりません。', 'error');
            return;
        }

        masterData = parsed;
        saveMasterToStorage();
        updateMasterStatus();
        showToast(`マスターを更新しました (${Object.keys(masterData).length}件のSKU)`);
    });

    btnConvert.addEventListener('click', () => {
        if (Object.keys(masterData).length === 0) {
            showToast('先にマスターを登録してください。', 'error');
            return;
        }

        const skus = skuInput.value.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (skus.length === 0) {
            showToast('変換対象のSKUを入力してください。', 'error');
            return;
        }

        const results = convertSKUs(skus);
        displayResults(results);
    });

    btnManual.addEventListener('click', () => {
        // Opening the local manual file
        window.open('manual.html', '_blank');
    });

    // Copy Functions
    btnCopyAsin.addEventListener('click', () => {
        const asins = Array.from(resultsTableBody.querySelectorAll('tr'))
            .map(tr => tr.cells[0].textContent)
            .join('\n');
        copyToClipboard(asins, 'ASINリストをコピーしました');
    });

    btnCopyFull.addEventListener('click', () => {
        const fullRows = Array.from(resultsTableBody.querySelectorAll('tr'))
            .map(tr => `${tr.cells[0].textContent}\t${tr.cells[1].textContent}\t${tr.cells[2].textContent}`)
            .join('\n');
        copyToClipboard(fullRows, '全てのデータをコピーしました（タブ区切り）');
    });

    btnCopyMissed.addEventListener('click', () => {
        copyToClipboard(missedSkusTextarea.value, '未ヒットSKUをコピーしました');
    });

    // Helper Functions
    function parseMasterData(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return {};

        // Detect delimiter (Tab or Comma)
        const header = lines[0];
        const delimiter = header.includes('\t') ? '\t' : (header.includes(',') ? ',' : null);
        if (!delimiter) return {};

        const cols = header.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        const idxSKU = cols.findIndex(c => c === '出品者SKU');
        const idxASIN = cols.findIndex(c => c === 'ASIN 1');
        const idxName = cols.findIndex(c => c === '商品名' || c === 'item-name');

        if (idxSKU === -1 || idxASIN === -1) return {};

        const data = {};
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(delimiter).map(r => r.trim().replace(/^"|"$/g, ''));
            const sku = row[idxSKU];
            const asin = row[idxASIN];
            const name = idxName !== -1 ? row[idxName] : '';

            if (!sku || !asin) continue;

            if (!data[sku]) data[sku] = [];
            data[sku].push({ asin, name });
        }
        return data;
    }

    function convertSKUs(skus) {
        return skus.map(sku => {
            const matches = masterData[sku] || [];
            return {
                sku: sku,
                asin: matches.length > 0 ? matches[0].asin : '',
                name: matches.length > 0 ? matches[0].name : '',
                missed: matches.length === 0 ? 1 : 0,
                multiple: matches.length > 1 ? 1 : 0
            };
        });
    }

    function displayResults(results) {
        resultsTableBody.innerHTML = '';
        const missed = [];

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${res.asin}</td>
                <td>${res.sku}</td>
                <td>${res.name}</td>
                <td class="${res.missed ? 'flag-yes' : ''}">${res.missed || ''}</td>
                <td class="${res.multiple ? 'flag-yes' : ''}">${res.multiple || ''}</td>
            `;
            resultsTableBody.appendChild(tr);
            if (res.missed) missed.push(res.sku);
        });

        missedSkusTextarea.value = missed.join('\n');
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function saveMasterToStorage() {
        try {
            localStorage.setItem('sku_asin_master', JSON.stringify(masterData));
        } catch (e) {
            console.error('Storage error:', e);
            showToast('マスターの保存に失敗しました (容量制限の可能性があります)', 'error');
        }
    }

    function loadMasterFromStorage() {
        const saved = localStorage.getItem('sku_asin_master');
        if (saved) {
            try {
                masterData = JSON.parse(saved);
                updateMasterStatus();
            } catch (e) {
                console.error('Parse error:', e);
            }
        }
    }

    function updateMasterStatus() {
        const count = Object.keys(masterData).length;
        if (count > 0) {
            masterStatus.textContent = `${count}件 登録済み`;
            masterStatus.className = 'status-badge status-valid';
        } else {
            masterStatus.textContent = '未登録';
            masterStatus.className = 'status-badge status-missing';
        }
    }

    function copyToClipboard(text, message) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast(message);
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast'; // reset
        if (type === 'error') toast.classList.add('btn-action'); // reuse color
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
});
