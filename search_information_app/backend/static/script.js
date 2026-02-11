const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultsContainer");
const resultsSection = document.getElementById("resultsSection");

// 初始化预设按钮逻辑（略，请保留你原本生成的按钮逻辑）

searchBtn.addEventListener("click", async () => {
    const selected = Array.from(document.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
    const custom = document.getElementById("customCompany").value;
    const finalCompanies = [...selected, ...(custom ? [custom] : [])];

    if (finalCompanies.length === 0) return alert("请选择企业");

    searchBtn.disabled = true;
    document.getElementById("loadingSpinner").style.display = "inline-block";

    try {
        // 使用相对路径，浏览器会自动补全为 https://xxx.onrender.com/api/generate-report
        const resp = await fetch("/api/generate-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                companies: finalCompanies,
                date: document.getElementById("dateRange").value,
                key_words: document.getElementById("keyword").value
            })
        });
        const data = await resp.json();
        renderResults(data.reports);
    } catch (e) {
        alert("检索失败，请检查后端状态");
    } finally {
        searchBtn.disabled = false;
        document.getElementById("loadingSpinner").style.display = "none";
    }
});

function renderResults(reports) {
    resultsSection.style.display = "block";
    resultsContainer.innerHTML = reports.map(r => `
        <div class="report-card">
            <h4>${r.company}</h4>
            <p>${r.overview}</p>
        </div>
    `).join("");
}
