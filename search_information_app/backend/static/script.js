const companiesContainer = document.getElementById("companiesContainer");
const searchBtn = document.getElementById("searchBtn");
const resultsSection = document.getElementById("resultsSection");
const resultsContainer = document.getElementById("resultsContainer");
const spinner = document.getElementById("loadingSpinner");
const btnText = document.getElementById("btnText");

const PRESET_COMPANIES = ["华为", "腾讯", "字节跳动", "阿里巴巴", "拼多多", "小米", "网易", "美团", "京东", "携程", "百度", "快手"];

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

searchBtn.addEventListener("click", async () => {
    const selected = Array.from(document.querySelectorAll(".company-checkbox input:checked")).map(cb => cb.value);
    const customInput = document.getElementById("customCompany").value;
    const customCompanies = customInput ? customInput.split(/[，, ]+/).filter(v => v.trim()) : [];
    const finalCompanies = [...new Set([...selected, ...customCompanies])];

    if (finalCompanies.length === 0) {
        alert("请选择主体");
        return;
    }

    spinner.style.display = "inline-block";
    btnText.textContent = "执行中...";
    searchBtn.disabled = true;

    try {
        const resp = await fetch(`${window.location.origin}/api/generate-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                companies: finalCompanies,
                date: document.getElementById("dateRange").value,
                key_words: document.getElementById("keyword").value
            })
        });
        const data = await resp.json();
        renderResults(data.reports || []);
    } catch (error) {
        alert("检索失败");
    } finally {
        spinner.style.display = "none";
        btnText.textContent = "检 索";
        searchBtn.disabled = false;
    }
});

function renderResults(reports) {
    resultsContainer.innerHTML = "";
    resultsSection.style.display = "block";
    reports.forEach(report => {
        const card = document.createElement("div");
        card.className = "report-card";
        card.innerHTML = `
            <div class="company-header">
                <div class="company-logo">${(report.company || "企")[0]}</div>
                <div class="company-name">${report.company}</div>
            </div>
            <div class="report-content">
                <p>${report.overview}</p>
                ${(report.items || []).map(item => `<p><strong>${item.topic}：</strong>${item.fact}</p>`).join("")}
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}
