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
    const tabSku = document.getElementById('tab-sku');
    const tabAsin = document.getElementById('tab-asin');
    const resultsSection = document.getElementById('results-section');
    const resultsTableBody = document.querySelector('#results-table tbody');
    const missedSkusTextarea = document.getElementById('missed-skus');
    const missedSkusTitle = document.querySelector('.missed-skus-container h3');

    const btnCopyAsin = document.getElementById('btn-copy-asin');
    const btnCopyFull = document.getElementById('btn-copy-full');
    const btnCopyMissed = document.getElementById('btn-copy-missed');

    // State
    let masterDataBySku = {}; // Key: SKU, Value: [{asin, name}, ...]
    let masterDataByAsin = {}; // Key: ASIN, Value: [{sku, name}, ...]
    let currentMode = 'sku'; // 'sku' or 'asin'

    // Initialize
    loadMasterFromStorage();

    // Event Listeners
    btnUpload.addEventListener('click', () => fileInput.click());

    tabSku.addEventListener('click', () => setMode('sku'));
    tabAsin.addEventListener('click', () => setMode('asin'));

    function setMode(mode) {
        currentMode = mode;
        tabSku.classList.toggle('active', mode === 'sku');
        tabAsin.classList.toggle('active', mode === 'asin');
        skuInput.placeholder = mode === 'sku' ?
            "SKUリストを改行区切りで入力してください..." :
            "ASINリストを改行区切りで入力してください...";
        missedSkusTitle.textContent = mode === 'sku' ? "未ヒットSKU一覧" : "未ヒットASIN一覧";
    }

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
        if (Object.keys(parsed.bySku).length === 0) {
            showToast('有効な列名（出品者SKU, ASIN 1）が見つかりません。', 'error');
            return;
        }

        masterDataBySku = parsed.bySku;
        masterDataByAsin = parsed.byAsin;
        saveMasterToStorage();
        updateMasterStatus();
        showToast(`マスターを更新しました (${Object.keys(masterDataBySku).length}件のSKU)`);
    });

    btnConvert.addEventListener('click', () => {
        if (Object.keys(masterDataBySku).length === 0) {
            showToast('先にマスターを登録してください。', 'error');
            return;
        }

        const inputs = skuInput.value.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (inputs.length === 0) {
            showToast(`${currentMode === 'sku' ? 'SKU' : 'ASIN'}リストを入力してください。`, 'error');
            return;
        }

        const results = currentMode === 'sku' ? convertSKUs(inputs) : convertASINs(inputs);
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
        const label = currentMode === 'sku' ? 'SKU' : 'ASIN';
        copyToClipboard(missedSkusTextarea.value, `未ヒット${label}をコピーしました`);
    });

    // Helper Functions
    function parseMasterData(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return { bySku: {}, byAsin: {} };

        // Detect delimiter (Tab or Comma)
        const header = lines[0];
        const delimiter = header.includes('\t') ? '\t' : (header.includes(',') ? ',' : null);
        if (!delimiter) return { bySku: {}, byAsin: {} };

        const cols = header.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        const idxSKU = cols.findIndex(c => c === '出品者SKU');
        const idxASIN = cols.findIndex(c => c === 'ASIN 1');
        const idxName = cols.findIndex(c => c === '商品名' || c === 'item-name');

        if (idxSKU === -1 || idxASIN === -1) return { bySku: {}, byAsin: {} };

        const bySku = {};
        const byAsin = {};
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(delimiter).map(r => r.trim().replace(/^"|"$/g, ''));
            const sku = row[idxSKU];
            const asin = row[idxASIN];
            const name = idxName !== -1 ? row[idxName] : '';

            if (!sku || !asin) continue;

            if (!bySku[sku]) bySku[sku] = [];
            bySku[sku].push({ asin, name });

            if (!byAsin[asin]) byAsin[asin] = [];
            byAsin[asin].push({ sku, name });
        }
        return { bySku, byAsin };
    }

    function convertSKUs(skus) {
        return skus.map(sku => {
            const matches = masterDataBySku[sku] || [];
            return {
                sku: sku,
                asin: matches.length > 0 ? matches[0].asin : '',
                name: matches.length > 0 ? matches[0].name : '',
                missed: matches.length === 0 ? 1 : 0,
                multiple: matches.length > 1 ? 1 : 0
            };
        });
    }

    function convertASINs(asins) {
        return asins.map(asin => {
            const matches = masterDataByAsin[asin] || [];
            return {
                asin: asin,
                sku: matches.length > 0 ? matches[0].sku : '',
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
            if (res.missed) {
                missed.push(currentMode === 'sku' ? res.sku : res.asin);
            }
        });

        missedSkusTextarea.value = missed.join('\n');
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function saveMasterToStorage() {
        try {
            const dataToSave = { bySku: masterDataBySku, byAsin: masterDataByAsin };
            localStorage.setItem('sku_asin_master_v2', JSON.stringify(dataToSave));
        } catch (e) {
            console.error('Storage error:', e);
            showToast('マスターの保存に失敗しました (容量制限の可能性があります)', 'error');
        }
    }

    function loadMasterFromStorage() {
        // Try v2 first
        const savedV2 = localStorage.getItem('sku_asin_master_v2');
        if (savedV2) {
            try {
                const parsed = JSON.parse(savedV2);
                masterDataBySku = parsed.bySku;
                masterDataByAsin = parsed.byAsin;
                updateMasterStatus();
                return;
            } catch (e) { console.error('Parse error v2:', e); }
        }

        // Fallback to v1 and migrate
        const savedV1 = localStorage.getItem('sku_asin_master');
        if (savedV1) {
            try {
                masterDataBySku = JSON.parse(savedV1);
                // Rebuild ASIN index
                masterDataByAsin = {};
                for (const sku in masterDataBySku) {
                    masterDataBySku[sku].forEach(item => {
                        if (!masterDataByAsin[item.asin]) masterDataByAsin[item.asin] = [];
                        masterDataByAsin[item.asin].push({ sku, name: item.name });
                    });
                }
                updateMasterStatus();
            } catch (e) { console.error('Parse error v1:', e); }
        }
    }

    function updateMasterStatus() {
        const count = Object.keys(masterDataBySku).length;
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
