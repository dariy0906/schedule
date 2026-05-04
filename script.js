const STORAGE_KEY = "selectedClassId";
const REPO_RAW_URL = "https://raw.githubusercontent.com/dariy0906/schedule/main/data.json";
let currentData = null;

const DAYS = [
    { value: "10000", label: "Понедельник" },
    { value: "01000", label: "Вторник" },
    { value: "00100", label: "Среда" },
    { value: "00010", label: "Четверг" },
    { value: "00001", label: "Пятница" }
];

const BREAKS_ORDER = [
    { afterPeriod: 1, key: "break1" },
    { afterPeriod: 2, key: "break2" },
    { afterPeriod: 3, key: "break3" },
    { afterPeriod: 4, key: "break4" },
    { afterPeriod: 5, key: "break5" },
    { afterPeriod: 6, key: "break6" },
    { afterPeriod: 7, key: "break7" }
];

async function loadData() {
    const res = await fetch("data.json");
    if (!res.ok) {
        throw new Error(`Не удалось загрузить data.json (${res.status})`);
    }
    currentData = await res.json();
    return currentData;
}

async function refreshData() {
    const statusEl = document.getElementById("refreshStatus");
    const btn = document.getElementById("refreshBtn");
    btn.disabled = true;
    statusEl.textContent = "Обновление...";
    try {
        const res = await fetch(REPO_RAW_URL + "?t=" + Date.now());
        if (!res.ok) {
            throw new Error(`Ошибка загрузки с GitHub (${res.status})`);
        }
        const newData = await res.json();
        const newCards = newData?.r?.dbiAccessorRes?.tables?.find(t => t.id === "cards")?.data_rows || [];
        const oldCards = currentData?.r?.dbiAccessorRes?.tables?.find(t => t.id === "cards")?.data_rows || [];

        if (JSON.stringify(newCards) === JSON.stringify(oldCards)) {
            statusEl.textContent = "Расписание уже актуально";
        } else {
            currentData = newData;
            statusEl.textContent = "Расписание обновлено!";
            render();
        }
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Ошибка: " + err.message;
    } finally {
        btn.disabled = false;
        setTimeout(() => { statusEl.textContent = ""; }, 5000);
    }
}

function getTableRows(data, tableId) {
    const tables = data?.r?.dbiAccessorRes?.tables;
    if (!Array.isArray(tables)) return [];
    const table = tables.find((item) => item.id === tableId);
    return Array.isArray(table?.data_rows) ? table.data_rows : [];
}

function getSubjectName(subjects, id) {
    const subject = subjects.find((item) => item.id === id);
    return subject ? subject.name : "—";
}

function getClassroomName(classrooms, id) {
    const classroom = classrooms.find((item) => item.id === id);
    return classroom ? classroom.name : "—";
}

function getTeacherName(teachers, id) {
    const teacher = teachers.find((item) => item.id === id);
    return teacher ? teacher.short : "";
}

function getBreakName(breaks, afterPeriod) {
    const brk = breaks.find(b => {
        const bt = b.starttime || "";
        const periods = getTableRows(currentData, "periods");
        const nextPeriod = periods.find(p => parseInt(p.period) === afterPeriod + 1);
        if (!nextPeriod) return false;
        return bt && bt < nextPeriod.starttime;
    });

    const knownBreaks = {
        1: "Breakfast 1",
        2: "Breakfast 2",
        3: "Reading Time",
        4: "Lunch 1",
        5: "Lunch 2",
        6: "Afternoon 1",
        7: "Afternoon 2"
    };

    return knownBreaks[afterPeriod] || "Перемена";
}

function buildColumns() {
    const columns = [];
    columns.push({ type: "day", label: "День" });

    const periods = getTableRows(currentData, "periods");
    const maxPeriod = Math.min(periods.length, 10);

    for (let i = 1; i <= maxPeriod; i++) {
        columns.push({ type: "period", index: i, label: `${i} урок` });
        if (i < maxPeriod) {
            columns.push({ type: "break", afterPeriod: i, label: getBreakName([], i) });
        }
    }

    return columns;
}

function render() {
    const selectedClass = document.getElementById("classSelect").value;
    const thead = document.getElementById("scheduleHead");
    const tbody = document.getElementById("scheduleBody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!currentData) {
        tbody.innerHTML = `<tr><td colspan="100">Загрузка...</td></tr>`;
        return;
    }

    const lessons = getTableRows(currentData, "lessons");
    const cards = getTableRows(currentData, "cards");
    const subjects = getTableRows(currentData, "subjects");
    const classrooms = getTableRows(currentData, "classrooms");
    const teachers = getTableRows(currentData, "teachers");

    const columns = buildColumns();

    const headRow = document.createElement("tr");
    columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col.label;
        if (col.type === "break") th.classList.add("break-header");
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    DAYS.forEach(day => {
        const tr = document.createElement("tr");

        const dayTd = document.createElement("td");
        dayTd.textContent = day.label;
        tr.appendChild(dayTd);

        for (let c = 1; c < columns.length; c++) {
            const col = columns[c];
            const td = document.createElement("td");

            if (col.type === "break") {
                td.classList.add("break-cell");
                td.textContent = col.label;
            } else if (col.type === "period") {
                const periodCards = cards.filter(card =>
                    card.days === day.value &&
                    parseInt(card.period) === col.index
                ).sort((a, b) => Number(a.period) - Number(b.period));

                const match = periodCards.find(card => {
                    const lesson = lessons.find(l => l.id === card.lessonid);
                    return lesson && Array.isArray(lesson.classids) && lesson.classids.includes(selectedClass);
                });

                if (match) {
                    const lesson = lessons.find(l => l.id === match.lessonid);
                    const subject = getSubjectName(subjects, lesson.subjectid);
                    const roomId = Array.isArray(match.classroomids) ? match.classroomids[0] : null;
                    const room = getClassroomName(classrooms, roomId);
                    const teacherId = Array.isArray(lesson.teacherids) ? lesson.teacherids[0] : null;
                    const teacher = getTeacherName(teachers, teacherId);

                    td.classList.add("lesson-cell");
                    td.innerHTML = `<span class="subject">${subject}</span><span class="room">${room}</span><span class="teacher">${teacher}</span>`;
                } else {
                    td.classList.add("empty-cell");
                    td.textContent = "—";
                }
            }

            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });
}

const classSelect = document.getElementById("classSelect");

classSelect.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEY, classSelect.value);
    render();
});

document.getElementById("refreshBtn").addEventListener("click", refreshData);

window.addEventListener("load", () => {
    loadData().then(() => {
        const savedClass = localStorage.getItem(STORAGE_KEY);
        const isExistingClass = Array.from(classSelect.options).some(o => o.value === savedClass);
        if (isExistingClass) classSelect.value = savedClass;
        render();
    });
});
