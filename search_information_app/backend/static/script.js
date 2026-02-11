const companiesContainer = document.getElementById("companiesContainer");
const searchBtn = document.getElementById("searchBtn");
const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const spinner = document.getElementById("loadingSpinner");
const btnText = document.getElementById("btnText");

// 预设主体名单
const PRESET_COMPANIES = ["华为", "腾讯", "字节跳动", "阿里巴巴", "拼多多", "小米", "网易", "美团", "京东", "携程", "百度", "快手"];

// 初始化加载预设主体
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

/**
 * 自动脱壳函数：处理 Dify 嵌套格式
 */
function autoUnwrap(data) {
    if (data.text1 && typeof data.text1 === 'string') {
        try {
            let cleanStr = data.text1.replace(/```json\n?|```/g, '').trim();
            return JSON.parse(cleanStr);
        } catch (e) {
            console.error("解析 text1 失败", e);
        }
    }
    return data;
}

searchBtn.addEventListener("click", async () => {
    // 1. 获取勾选的主体
    const selected = Array.from(
        document.querySelectorAll(".company-checkbox input:checked")
    ).map(cb => cb.value);

    // 2. 获取输入的主体
    const customInput = document.getElementById("customCompany").value;
    const customCompanies = customInput ? customInput.split(/[，, ]+/).filter(v => v.trim()) : [];

    // 3. 合并去重
    const finalCompanies = [...new Set([...selected, ...customCompanies])];

    if (finalCompanies.length === 0) {
        alert("请选择或输入至少一个检索主体");
        return;
    }

    const date = document.getElementById("dateRange").value;
    const key_words = document.getElementById("keyword").value;

    spinner.style.display = "inline-block";
    btnText.textContent = "执行检索中...";
    searchBtn.disabled = true;

    try {
        const resp = await fetch("/api/generate-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companies: finalCompanies, date, key_words })
        });

        const data = await resp.json();
        const processedReports = (data.reports || []).map(report => autoUnwrap(report));
        renderResults(processedReports);

    } catch (error) {
        console.error("Fetch error:", error);
    } finally {
        spinner.style.display = "none";
        btnText.textContent = "检索完成";
        searchBtn.disabled = false;
    }
});

/**
 * 渲染结果
 */
function renderResults(reports) {
    resultsContainer.innerHTML = "";
    resultsSection.style.display = "block";

    reports.forEach(report => {
        const card = document.createElement("div");
        card.className = "report-card";

        const overviewHtml = `<p class="compact-overview">${report.overview || ""}</p>`;

        let itemsHtml = "";
        (report.items || []).forEach(item => {
            itemsHtml += `<p class="compact-item-line"><strong>${item.date}｜${item.topic}：</strong>${item.fact}${item.analysis}</p>`;
        });

        let sourcesHtml = "";
        let finalSources = [];
        if (report.formatted_sources) {
            finalSources = report.formatted_sources;
        } else {
            const seenUrls = new Set();
            (report.items || []).forEach(item => {
                (item.sources || []).forEach(s => {
                    if (s.url && !seenUrls.has(s.url)) {
                        seenUrls.add(s.url);
                        finalSources.push({ id: finalSources.length + 1, title: s.title, url: s.url });
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
