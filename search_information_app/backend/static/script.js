// static/script.js
const companiesContainer = document.getElementById("companiesContainer");
const searchBtn = document.getElementById("searchBtn");
const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const spinner = document.getElementById("loadingSpinner");
const btnText = document.getElementById("btnText");

const PRESET_COMPANIES = ["华为", "腾讯", "字节跳动", "阿里巴巴", "拼多多", "小米", "网易", "美团", "京东", "携程", "百度", "快手"];

// 初始化主体
PRESET_COMPANIES.forEach(name => {
    const div = document.createElement("div");
    div.className = "company-checkbox";
    div.innerHTML = `<input type="checkbox" value="${name}" /><span>${name}</span>`;
    div.addEventListener("click", e => {
        if (e.target.tagName !== "INPUT") {
            const checkbox = div.querySelector("input");
            checkbox.checked = !checkbox.checked;
        }
    });
    companiesContainer.appendChild(div);
});

function autoUnwrap(data) {
    if (data.text1 && typeof data.text1 === 'string') {
        try {
            let cleanStr = data.text1.replace(/```json\n?|```/g, '').trim();
            return JSON.parse(cleanStr);
        } catch (e) { console.error("解析失败", e); }
    }
    return data;
}

searchBtn.addEventListener("click", async () => {
    const selected = Array.from(document.querySelectorAll(".company-checkbox input:checked")).map(cb => cb.value);
    const customInput = document.getElementById("customCompany").value;
    const customCompanies = customInput ? customInput.split(/[，, ]+/).filter(v => v.trim()) : [];
    const finalCompanies = [...new Set([...selected, ...customCompanies])];

    if (finalCompanies.length === 0) return alert("请选择主体");

    spinner.style.display = "inline-block";
    btnText.textContent = "执行检索中...";
    searchBtn.disabled = true;

    try {
        const resp = await fetch("/api/generate-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companies: finalCompanies, date: document.getElementById("dateRange").value, key_words: document.getElementById("keyword").value })
        });
        const data = await resp.json();
        // 修正：确保每一项都经过 autoUnwrap 或后端已处理
        const processedReports = (data.reports || []).map(report => autoUnwrap(report));
        renderResults(processedReports);
    } catch (error) {
        console.error("Fetch error:", error);
    } finally {
        spinner.style.display = "none";
        btnText.textContent = "执行检索";
        searchBtn.disabled = false;
    }
});

function renderResults(reports) {
    resultsContainer.innerHTML = "";
    resultsSection.style.display = "block";

    reports.forEach(report => {
        const card = document.createElement("div");
        card.className = "report-card";

        const overviewHtml = `<p class="compact-overview">${report.overview || ""}</p>`;
        
        let itemsHtml = "";
        (report.items || []).forEach(item => {
            // 容错处理字段缺失
            const date = item.date || "";
            const topic = item.topic || "资讯";
            const fact = item.fact || "";
            const analysis = item.analysis || "";
            itemsHtml += `<p class="compact-item-line"><strong>${date}｜${topic}：</strong>${fact}${analysis}</p>`;
        });

        let sourcesHtml = "";
        // 核心修正：确保后端返回的 formatted_sources 被渲染
        let finalSources = report.formatted_sources || [];
        
        if (finalSources.length === 0) {
            const seenUrls = new Set();
            (report.items || []).forEach(item => {
                (item.sources || []).forEach(s => {
                    if (s.url && !seenUrls.has(s.url)) {
                        seenUrls.add(s.url);
                        finalSources.push({ id: finalSources.length + 1, title: s.title || "查看来源", url: s.url });
                    }
                });
            });
        }

        if (finalSources.length > 0) {
            const sourceLines = finalSources.map(s =>
                `<div class="compact-source-line">[${s.id}] <a href="${s.url}" target="_blank" class="reference-link">${s.title}</a></div>`
            ).join("");
            sourcesHtml = `<div class="compact-sources-container"><strong>信息来源：</strong>${sourceLines}</div>`;
        }

        card.innerHTML = `
            <div class="company-header">
                <div class="company-logo">${(report.company || "企")[0]}</div>
                <div class="company-name">${report.company || "未知主体"}</div>
            </div>
            <div class="report-content">${overviewHtml}${itemsHtml}${sourcesHtml}</div>
        `;
        resultsContainer.appendChild(card);
    });
}
