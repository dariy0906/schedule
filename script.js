const STORAGE_KEY = "selectedClassId";
const dataPromise = loadData();

async function loadData() {
    const res = await fetch("data.json");
    if (!res.ok) {
        throw new Error(`Не удалось загрузить data.json (${res.status})`);
    }
    return res.json();
}

function getTableRows(data, tableId) {
    const tables = data?.r?.dbiAccessorRes?.tables;
    if (!Array.isArray(tables)) return [];

    const table = tables.find((item) => item.id === tableId);
    return Array.isArray(table?.data_rows) ? table.data_rows : [];
}

function getSubjectName(subjects, id) {
    const subject = subjects.find((item) => item.id === id);
    return subject ? subject.name : "Неизвестно";
}

function getClassroomName(classrooms, id) {
    const classroom = classrooms.find((item) => item.id === id);
    return classroom ? classroom.name : "—";
}

function render(day, selectedClass) {
    const tbody = document.querySelector("#schedule tbody");
    tbody.innerHTML = "";

    dataPromise
        .then((data) => {
            const lessons = getTableRows(data, "lessons");
            const cards = getTableRows(data, "cards");
            const subjects = getTableRows(data, "subjects");
            const classrooms = getTableRows(data, "classrooms");

            cards
                .filter((card) => card.days === day)
                .sort((a, b) => Number(a.period) - Number(b.period))
                .forEach((card) => {
                    const lesson = lessons.find((item) => item.id === card.lessonid);
                    if (!lesson) return;

                    if (!Array.isArray(lesson.classids) || !lesson.classids.includes(selectedClass)) {
                        return;
                    }

                    const roomId = Array.isArray(card.classroomids) ? card.classroomids[0] : null;
                    const subject = getSubjectName(subjects, lesson.subjectid);
                    const room = getClassroomName(classrooms, roomId);

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                    <td>${card.period}</td>
                    <td>${subject}</td>
                    <td>${room}</td>
                `;
                    tbody.appendChild(tr);
                });

            if (!tbody.children.length) {
                tbody.innerHTML = `<tr><td colspan="3">Нет уроков</td></tr>`;
            }
        })
        .catch((error) => {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="3">Ошибка загрузки расписания</td></tr>`;
        });
}

const daySelect = document.getElementById("daySelect");
const classSelect = document.getElementById("classSelect");

function update() {
    const selectedClass = classSelect.value;
    localStorage.setItem(STORAGE_KEY, selectedClass);
    render(daySelect.value, selectedClass);
}

daySelect.addEventListener("change", update);
classSelect.addEventListener("change", update);

window.addEventListener("load", () => {
    const savedClass = localStorage.getItem(STORAGE_KEY);
    const isExistingClass = Array.from(classSelect.options).some((option) => option.value === savedClass);

    if (isExistingClass) {
        classSelect.value = savedClass;
    }

    update();
})