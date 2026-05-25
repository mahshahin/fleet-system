    const API_URL = "https://script.google.com/macros/s/AKfycbwG7q8kD0GotJ3tPmbu6Q9bgzkaihP1DeXVNeYuQoZtHh9q3lDZVFF_70ZTOP5TuSRxSA/exec"; 

    let isAdmin = false; const ADMIN_PASSWORD = "1234"; let currentFleet = "A359"; let fleetData = {};

    async function fetchFromCloud() {
        showSyncStatus("🔄 Connecting to Cloud DB...", "#e2e8f0", "#64748b");
        try {
            let response = await fetch(API_URL);
            let cloudData = await response.json();
            // 🎯 السطر السحري عشان نقفش الداتا في الـ Console فوراً
            console.log("My Raw Fleet Data:", cloudData);
            if (cloudData && (cloudData.A359 || cloudData.B738M)) {
                // 💡 كود الفلترة والإصلاح الجذري: لو لقى حروف "bma" القديمة المرفوعة على السيرفر هيصلحها لحروفك الحقيقية فوراً
                if (cloudData.B738M && cloudData.B738M.aircrafts && cloudData.B738M.aircrafts.includes("bma")) {
                    console.log("Old aircraft IDs detected on server. Rewriting with correct registrations...");
                    cloudData.B738M.aircrafts = ["ggm", "ggn", "ggl"];
                    cloudData.B738M.labels = {
                        "ggm": { title: "SU-GGM", color: "#6366f1" },
                        "ggn": { title: "SU-GGN", color: "#8b5cf6" },
                        "ggl": { title: "SU-GGL", color: "#38bdf8" }
                    };
                    
                    // تحويل الداتا داخل صفوف المحطات من المفاتيح القديمة للجديدة للحفاظ على الـ ✔️
                    if (cloudData.B738M.stations) {
                        cloudData.B738M.stations.forEach(st => {
                            if (st.hasOwnProperty("bma")) { st.ggm = st.bma; delete st.bma; }
                            if (st.hasOwnProperty("bmb")) { st.ggn = st.bmb; delete st.bmb; }
                            if (st.hasOwnProperty("bmc")) { st.ggl = st.bmc; delete st.bmc; }
                        });
                    }
                }

                // بناء الـ tco_tracks المعتمد على الطائرات
                ["A359", "B738M"].forEach(fleet => {
                    if (cloudData[fleet]) {
                        if (!cloudData[fleet].tco_tracks) {
                            cloudData[fleet].tco_tracks = {};
                            if (cloudData[fleet].tco && cloudData[fleet].aircrafts) {
                                cloudData[fleet].aircrafts.forEach(plane => {
                                    cloudData[fleet].tco_tracks[plane] = {
                                        uae: cloudData[fleet].tco.uae || "",
                                        uk: cloudData[fleet].tco.uk || "",
                                        eu: cloudData[fleet].tco.eu || ""
                                    };
                                });
                            }
                        }
                        if(!cloudData[fleet].stations) cloudData[fleet].stations = [];
                        if(!cloudData[fleet].aircrafts) cloudData[fleet].aircrafts = [];
                        if(!cloudData[fleet].labels) cloudData[fleet].labels = {};
                    }
                });

                fleetData = cloudData;
                showSyncStatus("☁️", "#dcfce7", "#15803d");
            } else {
                fleetData = getDefaultData();
                await saveToCloud();
            }
            initializeDashboard();
        } catch (error) {
            console.error("Cloud Fetch Error: ", error);
            showSyncStatus("❌ Offline Mode (Using Cache)", "#fee2e2", "#b91c1c");
            fleetData = JSON.parse(localStorage.getItem('egyptair_fleet_cache')) || getDefaultData();
            initializeDashboard();
        }
    }

    async function saveToCloud() {
        showSyncStatus("⏳ Saving to Cloud...", "#fef9c3", "#a16207");
        localStorage.setItem('egyptair_fleet_cache', JSON.stringify(fleetData));
        try {
            let response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify(fleetData)
            });
            let res = await response.json();
            if(res.status === "success") {
                showSyncStatus("☁️ Cloud DB Updated", "#dcfce7", "#15803d");
            } else {
                showSyncStatus("⚠️ Save Error", "#fee2e2", "#b91c1c");
            }
        } catch(e) {
            showSyncStatus("⚠️ Network error (Saved locally)", "#fee2e2", "#b91c1c");
        }
    }

    function showSyncStatus(text, bg, color) {
        const el = document.getElementById('sync-status');
        if(el) { el.innerText = text; el.style.backgroundColor = bg; el.style.color = color; }
    }

    function openPasswordModal() {
        document.getElementById('admin-password-input').value = '';
        document.getElementById('password-error-msg').style.display = 'none';
        document.getElementById('password-modal').style.display = 'flex';
        setTimeout(() => { document.getElementById('admin-password-input').focus(); }, 100);
    }

    function closePasswordModal() { document.getElementById('password-modal').style.display = 'none'; }

    // دالة سحرية لتشفيير الباسورد قبل الفحص
    async function sha256(string) {
        const utf8 = new Uint8Array(Array.from(string).map(c => c.charCodeAt(0)));
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function verifyAdminPassword() {
        const enteredPass = document.getElementById('admin-password-input').value;
        
        // تشفير الباسورد المدخلة
        const enteredHash = await sha256(enteredPass);
        
        // المقارنة بتتم بين كودين مشفرين (مفيش أي باسورد صريحة في الكود هنا)
        const SECURE_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // 

        if (enteredHash === SECURE_HASH) {
            isAdmin = true;
            document.getElementById('admin-btn').style.display = 'none';
            document.getElementById('lock-btn').style.display = 'inline-block';
            document.getElementById('manage-btn').style.display = 'inline-block';
            closePasswordModal();
            openModal(); 
        } else {
            document.getElementById('password-error-msg').style.display = 'block';
            document.getElementById('admin-password-input').value = '';
            document.getElementById('admin-password-input').focus();
        }
    }

    function lockDashboard() {
        isAdmin = false;
        document.getElementById('admin-btn').style.display = 'inline-block';
        document.getElementById('lock-btn').style.display = 'none';
        document.getElementById('manage-btn').style.display = 'none';
        closeModal();
    }

    function triggerPrintGuide() { 
        window.print(); 
    }

    function switchFleet(fleetCode) {
        currentFleet = fleetCode;
        document.getElementById('tab-A359').classList.toggle('active', fleetCode === 'A359');
        document.getElementById('tab-B738M').classList.toggle('active', fleetCode === 'B738M');
        document.getElementById('fleet-subtitle').innerText = `Active Fleet: ${fleetData[fleetCode].title} Dashboard`;
        
        document.getElementById('station-search-filter').value = '';
        document.getElementById('region-filter').value = 'all';
        document.getElementById('status-filter').value = 'all';

        initializeDashboard();
    }

    function initializeDashboard() {
        buildStatsCards();
        renderTcoTable();
        buildTableHeaders();
        buildAircraftFilterDropdown();
        renderTableRows();
    }

    function buildStatsCards() {
        const container = document.getElementById('stats-container'); container.innerHTML = '';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        f.aircrafts.forEach(plane => {
            const card = document.createElement('div'); card.className = `stat-card card-${plane}`;
            card.style.borderRightColor = f.labels[plane]?.color || "#cbd5e1";
            card.innerHTML = `<h3>${f.labels[plane]?.title || plane.toUpperCase()} Approved Stations</h3><div class="stat-number" id="count-${plane}">0</div>`;
            container.appendChild(card);
        });
    }

    function renderTcoTable() {
        const tbody = document.getElementById('tco-table-body');
        tbody.innerHTML = '';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        
        if (!f.tco_tracks) f.tco_tracks = {};

        f.aircrafts.forEach(plane => {
            const planeTco = f.tco_tracks[plane] || { uae: "", uk: "", eu: "" };
            const planeTitle = f.labels[plane]?.title || plane.toUpperCase();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${planeTitle}</strong></td>
                <td>${getTcoBadgeMarkup(planeTco.uae)}</td>
                <td>${getTcoBadgeMarkup(planeTco.uk)}</td>
                <td>${getTcoBadgeMarkup(planeTco.eu)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getTcoBadgeMarkup(val) {
        if(val === 'OK') {
            return `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 13px; color: #16a34a; letter-spacing: 0.5px; cursor: default;">
                    <span style="position: relative; display: flex; height: 8px; width: 8px;">
                        <span style="position: absolute; height: 100%; width: 100%; border-radius: 50%; background-color: #4ade80; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                        <span style="position: relative; display: inline-flex; border-radius: 50%; height: 8px; width: 8px; background-color: #16a34a; box-shadow: 0 0 8px #22c55e;"></span>
                    </span>
                    OK
                </div>`;
        }
        if(val === 'Under Processed') {
            return `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 13px; color: #d97706; letter-spacing: 0.5px; cursor: default;">
                    <span style="position: relative; display: flex; height: 8px; width: 8px;">
                        <span style="position: absolute; height: 100%; width: 100%; border-radius: 50%; background-color: #fbbf24; opacity: 0.75; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                        <span style="position: relative; display: inline-flex; border-radius: 50%; height: 8px; width: 8px; background-color: #d97706; box-shadow: 0 0 8px #f59e0b;"></span>
                    </span>
                    Under Processed   
                </div>`;
        }
        return `<span style="color: #cbd5e1; font-weight: 500; font-size: 14px;">—</span>`;
    }

    function buildTableHeaders() {
        const headerRow = document.getElementById('table-header-row');
        headerRow.innerHTML = '<th>Geographic Region</th><th>Station</th>';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        f.aircrafts.forEach(plane => {
            headerRow.innerHTML += `<th class="col-${plane}">${f.labels[plane]?.title || plane.toUpperCase()}</th>`;
        });
    }

    function buildAircraftFilterDropdown() {
        const filter = document.getElementById('aircraft-filter'); filter.innerHTML = '<option value="all">All Aircrafts</option>';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        f.aircrafts.forEach(plane => {
            filter.innerHTML += `<option value="${plane}">${f.labels[plane]?.title || plane.toUpperCase()}</option>`;
        });
    }

    function renderTableRows() {
        const tbody = document.getElementById('table-body'); tbody.innerHTML = '';
        const f = fleetData[currentFleet];
        if(!f || !f.stations) return;

        // 💡 ترتيب المحطات بناءً على الإقليم الجغرافي أوتوماتيكياً قبل الرسم
        const sortedStations = [...f.stations].sort((a, b) => a.region.localeCompare(b.region));

        sortedStations.forEach((row) => {
            const tr = document.createElement('tr'); tr.setAttribute('data-region', row.region);
            let html = `<td><strong>${row.region}</strong></td><td><code>${row.station}</code></td>`;
            f.aircrafts.forEach(plane => { html += `<td class="cell-${plane}">${getBadgeMarkup(row[plane] || "")}</td>`; });
            tr.innerHTML = html; tbody.appendChild(tr);
        });
        updateCounts();
    }

    function getBadgeMarkup(value) {
        if(value === '✔️') {
            return `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 13px; color: #16a34a; letter-spacing: 0.5px; cursor: default;">
                    <span style="position: relative; display: flex; h: 8px; w: 8px; height: 8px; width: 8px;">
                        <span style="position: absolute; inline-size: 100%; height: 100%; width: 100%; border-radius: 50%; background-color: #4ade80; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                        <span style="position: relative; display: inline-flex; border-radius: 50%; height: 8px; width: 8px; background-color: #16a34a; box-shadow: 0 0 8px #22c55e;"></span>
                    </span>
                    APPROVED
                </div>`;
        }
        if(value === 'Under Processed') {
            return `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 13px; color: #d97706; letter-spacing: 0.5px; cursor: default;">
                    <span style="position: relative; display: flex; height: 8px; width: 8px;">
                        <span style="position: absolute; height: 100%; width: 100%; border-radius: 50%; background-color: #fbbf24; opacity: 0.75; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                        <span style="position: relative; display: inline-flex; border-radius: 50%; height: 8px; width: 8px; background-color: #d97706; box-shadow: 0 0 8px #f59e0b;"></span>
                    </span>
                    Under Processed
                </div>`;
        }
        return `<span style="color: #cbd5e1; font-weight: 500; font-size: 14px;">—</span>`;
    }

    function openModal() {
        if(!isAdmin) return;
        document.getElementById('form-modal').style.display = 'flex';
        document.getElementById('management-type').value = 'station';
        document.getElementById('modal-title').innerText = `⚙️ ${fleetData[currentFleet].title} Control Panel`;
        buildDynamicStatusInputs(); populateStationDropdown(); populateAircraftRemovalDropdown(); handleManagementTypeChange();
    }
    
    function closeModal() { document.getElementById('form-modal').style.display = 'none'; }

    function handleManagementTypeChange() {
        const type = document.getElementById('management-type').value;
        document.getElementById('aircraft-section').style.display = (type === 'aircraft') ? 'block' : 'none';
        document.getElementById('station-section').style.display = (type === 'station') ? 'block' : 'none';
        document.getElementById('backup-section').style.display = (type === 'backup') ? 'block' : 'none';
        document.getElementById('modal-footer-actions').style.display = (type === 'backup') ? 'none' : 'flex';
        if(type === 'station') loadStationOrTcoData();
        if(type === 'aircraft') handleAircraftModeChange();
    }

    function handleAircraftModeChange() {
        const isAdd = document.getElementById('aircraft-mode').value === 'add';
        document.getElementById('aircraft-input-group').style.display = isAdd ? 'flex' : 'none';
        document.getElementById('aircraft-remove-group').style.display = isAdd ? 'none' : 'flex';
    }

    function handleModeChange() {
        const isAdd = document.getElementById('form-mode').value === 'add';
        document.getElementById('station-input-group').style.display = isAdd ? 'flex' : 'none';
        document.getElementById('btn-delete-station').style.display = isAdd ? 'none' : 'inline-block';
        if(!isAdd) loadStationOrTcoData();
    }

    function buildDynamicStatusInputs() {
        const container = document.getElementById('dynamic-status-inputs'); container.innerHTML = '';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        f.aircrafts.forEach(plane => {
            container.innerHTML += `<div class="form-group"><label>${f.labels[plane]?.title || plane.toUpperCase()}:</label>
                <select id="form-input-${plane}"><option value="">- Blank -</option><option value="✔️">✔️ Approved</option><option value="Under Processed">Under Processed</option></select></div>`;
        });
    }

    function populateStationDropdown() {
        const select = document.getElementById('form-station-select'); select.innerHTML = '';
        select.innerHTML += `<option value="TCO_MANAGEMENT">⭐ --- Manage TCO Approvals (By Aircraft) ---</option>`;
        select.innerHTML += `<option value="ADD_NEW_STATION_MODE">+ Add New Station Mode</option>`;

        if(fleetData[currentFleet] && fleetData[currentFleet].stations) {
            [...fleetData[currentFleet].stations].sort((a,b)=>a.station.localeCompare(b.station)).forEach(item => {
                select.innerHTML += `<option value="${item.station}">Station: ${item.station} (${item.region})</option>`;
            });
        }
    }

    function populateAircraftRemovalDropdown() {
        const select = document.getElementById('remove-aircraft-select'); select.innerHTML = '';
        const f = fleetData[currentFleet];
        if(!f || !f.aircrafts) return;
        f.aircrafts.forEach(plane => {
            select.innerHTML += `<option value="${plane}">${f.labels[plane]?.title || plane.toUpperCase()}</option>`;
        });
    }

    function loadStationOrTcoData() {
        const target = document.getElementById('form-station-select').value;
        const f = fleetData[currentFleet];
        const tcoSub = document.getElementById('tco-edit-sub-section');

        if(target === "TCO_MANAGEMENT") {
            tcoSub.style.display = 'block';
            document.getElementById('station-fields-wrapper').style.display = 'none';
            document.getElementById('btn-delete-station').style.display = 'none';
            
            tcoSub.innerHTML = '<p style="margin: 0 0 10px 0; font-weight: bold; color: #7c3aed; font-size:13px;">Update Aircraft TCO Statuses:</p>';
            if (!f.tco_tracks) f.tco_tracks = {};
            
            f.aircrafts.forEach(plane => {
                const planeTco = f.tco_tracks[plane] || { uae: "", uk: "", eu: "" };
                const planeTitle = f.labels[plane]?.title || plane.toUpperCase();
                
                tcoSub.innerHTML += `
                    <div style="background: #fff; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0;">
                        <span style="font-weight: bold; color: var(--primary);">${planeTitle}</span>
                        <div class="form-group" style="margin-top:5px;">
                            <label>UAE TCO:</label>
                            <select id="form-tco-uae-${plane}"><option value="">- Blank -</option><option value="OK">OK</option><option value="Under Processed">UNDER PROCESS</option></select>
                        </div>
                        <div class="form-group">
                            <label>UK TCO:</label>
                            <select id="form-tco-uk-${plane}"><option value="">- Blank -</option><option value="OK">OK</option><option value="Under Processed">UNDER PROCESS</option></select>
                        </div>
                        <div class="form-group">
                            <label>EU TCO:</label>
                            <select id="form-tco-eu-${plane}"><option value="">- Blank -</option><option value="OK">OK</option><option value="Under Processed">UNDER PROCESS</option></select>
                        </div>
                    </div>
                `;
            });
            
            f.aircrafts.forEach(plane => {
                const planeTco = f.tco_tracks[plane] || { uae: "", uk: "", eu: "" };
                document.getElementById(`form-tco-uae-${plane}`).value = planeTco.uae;
                document.getElementById(`form-tco-uk-${plane}`).value = planeTco.uk;
                document.getElementById(`form-tco-eu-${plane}`).value = planeTco.eu;
            });
        } 
        else if (target === "ADD_NEW_STATION_MODE") {
            tcoSub.style.display = 'none';
            document.getElementById('station-fields-wrapper').style.display = 'block';
            document.getElementById('station-input-group').style.display = 'flex';
            document.getElementById('btn-delete-station').style.display = 'none';
            document.getElementById('form-mode').value = 'add';
            document.getElementById('form-station-name').value = "";
            f.aircrafts.forEach(plane => { document.getElementById(`form-input-${plane}`).value = ""; });
        }
        else {
            tcoSub.style.display = 'none';
            document.getElementById('station-fields-wrapper').style.display = 'block';
            document.getElementById('station-input-group').style.display = 'none';
            document.getElementById('btn-delete-station').style.display = 'inline-block';
            document.getElementById('form-mode').value = 'edit';

            const data = f.stations.find(item => item.station === target);
            if(data) {
                document.getElementById('form-region').value = data.region;
                f.aircrafts.forEach(plane => { document.getElementById(`form-input-${plane}`).value = data[plane] || ""; });
            }
        }
    }

    function deleteStation() {
        const code = document.getElementById('form-station-select').value;
        if(code === "TCO_MANAGEMENT" || code === "ADD_NEW_STATION_MODE") return;
        fleetData[currentFleet].stations = fleetData[currentFleet].stations.filter(item => item.station !== code);
        saveToCloud(); initializeDashboard(); closeModal();
    }

    function exportSystemData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fleetData));
        const downloadAnchor = document.createElement('a'); downloadAnchor.setAttribute("href", dataStr); downloadAnchor.setAttribute("download", "egyptair_fleet_backup.json");
        document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
    }

    function importSystemData() {
        const fileInput = document.getElementById('import-file-input'); if (fileInput.files.length === 0) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.A359) { fleetData = importedData; saveToCloud(); initializeDashboard(); closeModal(); }
            } catch (err) {}
        };
        reader.readAsText(fileInput.files[0]);
    }

    async function saveManagementForm() {
    const type = document.getElementById('management-type').value; const f = fleetData[currentFleet];

    if(type === 'aircraft') {
        if(document.getElementById('aircraft-mode').value === 'add') {
            const name = document.getElementById('new-aircraft-name').value.trim().toUpperCase(); 
            if(!name) {
                showNotification("⚠️ Please enter a valid Aircraft Registration!", "warning");
                return;
            }
            const key = name.replace(/[^A-Z0-9]/g, "").toLowerCase(); 
            
            // حماية لمنع تكرار الطائرة
            if(f.aircrafts.includes(key)) {
                showNotification(`❌ Aircraft (${name}) already exists!`, "error");
                return;
            }
            
            f.aircrafts.push(key);
            f.labels[key] = { title: name, color: "#" + Math.floor(Math.random()*16777215).toString(16) }; f.stations.forEach(r => r[key] = "");
            showNotification(`✈️ Aircraft ${name} added successfully!`, "success");
        } else {
            const target = document.getElementById('remove-aircraft-select').value;
            const planeTitle = f.labels[target]?.title || target.toUpperCase();
            f.aircrafts = f.aircrafts.filter(p => p !== target); delete f.labels[target]; f.stations.forEach(r => delete r[target]);
            showNotification(`🗑️ Aircraft ${planeTitle} removed.`, "warning");
        }
    } else {
        const target = document.getElementById('form-station-select').value;

        if(target === "TCO_MANAGEMENT") {
            if(!f.tco_tracks) f.tco_tracks = {};
            f.aircrafts.forEach(plane => {
                f.tco_tracks[plane] = {
                    uae: document.getElementById(`form-tco-uae-${plane}`).value,
                    uk: document.getElementById(`form-tco-uk-${plane}`).value,
                    eu: document.getElementById(`form-tco-eu-${plane}`).value
                };
            });
            showNotification("📋 TCO Requirements updated successfully!", "success");
        } 
        else {
            const mode = document.getElementById('form-mode').value; const region = document.getElementById('form-region').value;
            let vals = {}; f.aircrafts.forEach(p => vals[p] = document.getElementById(`form-input-${p}`).value);

            if(target === "ADD_NEW_STATION_MODE") {
                const sName = document.getElementById('form-station-name').value.trim().toUpperCase();
                if (!sName) {
                    showNotification("⚠️ Please enter a valid Station Code!", "warning");
                    return;
                }
                
                // التنبيه الاحترافي لمنع تكرار المحطة
                if (f.stations.some(i => i.station === sName)) {
                    showNotification(`❌ Station (${sName}) already exists in this fleet!`, "error");
                    return;
                }
                let newRow = { region, station: sName }; f.aircrafts.forEach(p => newRow[p] = vals[p]); f.stations.push(newRow);
                showNotification(`📍 Station ${sName} added successfully!`, "success");
            } else {
                const idx = f.stations.findIndex(i => i.station === target);
                if(idx !== -1) { 
                    f.stations[idx].region = region; f.aircrafts.forEach(p => f.stations[idx][p] = vals[p]); 
                    showNotification(`✏️ Station ${target} updated successfully!`, "success");
                }
            }
        }
    }
    await saveToCloud(); initializeDashboard(); closeModal();
}

    function updateCounts() {
        if(!fleetData[currentFleet] || !fleetData[currentFleet].aircrafts) return;
        fleetData[currentFleet].aircrafts.forEach(plane => {
            let count = fleetData[currentFleet].stations.filter(r => r[plane] === '✔️').length;
            if(document.getElementById(`count-${plane}`)) document.getElementById(`count-${plane}`).innerText = count;
        });
    }

    function filterTable() {
    const f = fleetData[currentFleet]; 
    const s = document.getElementById('station-search-filter').value.trim().toUpperCase();
    const rVal = document.getElementById('region-filter').value; 
    const aVal = document.getElementById('aircraft-filter').value; 
    const stVal = document.getElementById('status-filter').value.trim().toLowerCase(); // قراءة الفلتر بحروف صغيرة
    
    // 1. التحكم في إظهار وإخفاء الأعمدة والكروت بناءً على فلتر الطائرة المختارة
    f.aircrafts.forEach(p => {
        let disp = (aVal === 'all' || aVal === p) ? '' : 'none';
        if(document.querySelector(`.col-${p}`)) document.querySelector(`.col-${p}`).style.display = disp;
        document.querySelectorAll(`.cell-${p}`).forEach(c => c.style.display = disp);
        if(document.querySelector(`.card-${p}`)) document.querySelector(`.card-${p}`).style.display = disp;
    });

    // 2. الفلترة الذكية بقراءة النص الصافي المعروض جوه الـ Div الجديد
    document.querySelectorAll('#table-body tr').forEach((row) => {
        const rowRegion = row.getAttribute('data-region');
        const rowStation = row.querySelector('code').innerText.trim().toUpperCase();
        
        const matchS = s === '' || rowStation.includes(s); 
        const matchR = rVal === 'all' || rowRegion === rVal;
        
        let matchSt = false;
        if (stVal === 'all') {
            matchSt = true;
        } else {
            if (aVal !== 'all') {
                // لو مختارين طائرة محددة، بنقرا نص الخلية ونحوله لسمول تماماً
                const cell = row.querySelector(`.cell-${aVal}`);
                const cellText = cell ? cell.innerText.trim().toLowerCase() : "";
                
                if (stVal === "approved") {
                    matchSt = cellText.includes("approved") || cellText.includes("approve");
                } else if (stVal === "under process") {
                    matchSt = cellText.includes("under") || cellText.includes("processed");
                } else if (stVal === "") {
                    matchSt = cellText === "—" || cellText === "-" || cellText === "";
                }
            } else {
                // لو بندور في كل خلايا السطر (All Aircrafts)
                const cells = Array.from(row.querySelectorAll('td')).slice(2);
                const cellsText = cells.map(td => td.innerText.trim().toLowerCase());
                
                if (stVal === "approved") {
                    matchSt = cellsText.some(t => t.includes("approved") || t.includes("approve"));
                } else if (stVal === "under process") {
                    matchSt = cellsText.some(t => t.includes("under") || t.includes("processed"));
                } else if (stVal === "") {
                    matchSt = cellsText.some(t => t === "—" || t === "-" || t === "");
                }
            }
        }
        
        row.style.display = (matchS && matchR && matchSt) ? '' : 'none';
    });
}

    function getDefaultData() {
        return {
            A359: {
                title: "Airbus A350-900", aircrafts: ["gge", "ggh", "ggi"],
                labels: { "gge": { title: "SU-GGE", color: "#ec4899" }, "ggh": { title: "SU-GGH", color: "#10b981" }, "ggi": { title: "SU-GGI", color: "#f59e0b" } },
                tco_tracks: {
                    "gge": { uae: "OK", uk: "OK", eu: "OK" },
                    "ggh": { uae: "OK", uk: "UNDER PROCESS", eu: "OK" },
                    "ggi": { uae: "UNDER PROCESS", uk: "", eu: "UNDER PROCESS" }
                },
                stations: [
                    {region:"Middle East", station:"DXB", gge:"✔️", ggh:"✔️", ggi:"✔️"}, {region:"Middle East", station:"JED", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Middle East", station:"RUH", gge:"✔️", ggh:"✔️", ggi:"✔️"}, {region:"Middle East", station:"AMM", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Middle East", station:"KWI", gge:"✔️", ggh:"✔️", ggi:"✔️"}, {region:"Middle East", station:"DOH", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Middle East", station:"BAH", gge:"✔️", ggh:"✔️", ggi:""}, {region:"Europe", station:"LHR", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Europe", station:"CDG", gge:"✔️", ggh:"✔️", ggi:""}, {region:"Europe", station:"FRA", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Europe", station:"FCO", gge:"✔️", ggh:"✔️", ggi:""}, {region:"Europe", station:"ATH", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"Europe", station:"IST", gge:"✔️", ggh:"✔️", ggi:""}, {region:"America", station:"JFK", gge:"✔️", ggh:"✔️", ggi:"✔️"},
                    {region:"America", station:"IAD", gge:"✔️", ggh:"✔️", ggi:""}, {region:"Far East", station:"BKK", gge:"✔️", ggh:"✔️", ggi:""},
                    {region:"Far East", station:"NRT", gge:"✔️", ggh:"", ggi:""}, {region:"Far East", station:"CAN", gge:"Under Processed", ggh:"", ggi:""},
                    {region:"Africa", station:"CAI", gge:"✔️", ggh:"✔️", ggi:"✔️"}, {region:"Africa", station:"LOS", gge:"✔️", ggh:"", ggi:""},
                    {region:"Africa", station:"ACC", gge:"✔️", ggh:"", ggi:""}, {region:"Africa", station:"JNB", gge:"✔️", ggh:"✔️", ggi:"✔️"}
                ]
            },
            B738M: {
                title: "Boeing 737-8 MAX", aircrafts: ["ggm", "ggn", "ggl"],
                labels: { 
                    "ggm": { title: "SU-GGM", color: "#6366f1" }, 
                    "ggn": { title: "SU-GGN", color: "#8b5cf6" }, 
                    "ggl": { title: "SU-GGL", color: "#38bdf8" } 
                },
                tco_tracks: {
                    "ggm": { uae: "UNDER PROCESS", uk: "", eu: "UNDER PROCESS" },
                    "ggn": { uae: "", uk: "", eu: "" },
                    "ggl": { uae: "", uk: "", eu: "" }
                },
                stations: [
                    {region:"Middle East", station:"CAI", ggm:"✔️", ggn:"✔️", ggl:"✔️"}, {region:"Middle East", station:"RUH", ggm:"✔️", ggn:"✔️", ggl:""},
                    {region:"Middle East", station:"JED", ggm:"✔️", ggn:"Under Processed", ggl:""}, {region:"Middle East", station:"MED", ggm:"✔️", ggn:"", ggl:""},
                    {region:"Middle East", station:"DMM", ggm:"✔️", ggn:"", ggl:""}, {region:"Middle East", station:"MCT", ggm:"✔️", ggn:"", ggl:""},
                    {region:"Europe", station:"ATH", ggm:"✔️", ggn:"✔️", ggl:""}, {region:"Europe", station:"FCO", ggm:"✔️", ggn:"", ggl:""},
                    {region:"Europe", station:"MXP", ggm:"✔️", ggn:"", ggl:""}, {region:"Europe", station:"VIE", ggm:"✔️", ggn:"", ggl:""},
                    {region:"Europe", station:"BRU", ggm:"✔️", ggn:"", ggl:""}, {region:"Africa", station:"ADD", ggm:"✔️", ggn:"", ggl:""},
                    {region:"Africa", station:"KRT", ggm:"Under Processed", ggn:"", ggl:""}, {region:"Africa", station:"NBO", ggm:"✔️", ggn:"", ggl:""}
                ]
            }
        };
    }

    document.getElementById('admin-password-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') { verifyAdminPassword(); } });

    fetchFromCloud();
function showNotification(message, type = "error") {
    const toast = document.getElementById('custom-toast');
    toast.innerText = message;
    toast.style.display = 'flex';
    
    // تغيير اللون بناءً على نوع الرسالة
    if (type === "success") {
        toast.style.backgroundColor = "var(--success)"; // أخضر
    } else if (type === "warning") {
        toast.style.backgroundColor = "var(--warning)"; // أصفر
    } else {
        toast.style.backgroundColor = "var(--danger)"; // أحمر للغلط
    }
    
    // تختفي تلقائياً بعد 4 ثواني
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}
