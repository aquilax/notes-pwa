// ALL IMPORT STATEMENTS AT THE TOP
import {
  addOrUpdateNote,
  deleteNote,
  getAllNotes,
  getFileByIndex,
  getNote,
  getTotalFiles,
} from "./indexedDb.js";

// ALL QUERY SELECTORS
const body = document.querySelector("body");
const appContainer = document.querySelector(".app-container");

const indicator = document.getElementById("save-indicator");
const notepad = document.getElementById("notepad");
const fileNameElement = document.getElementById("filename");
const addFileBtn = document.querySelector(".add-btn");
const filesContainer = document.querySelector(".files-container");
const backBtn = document.querySelector(".back-btn");
const currentDeleteBtn = document.querySelector(".current-delete-btn");
const searchElement = document.getElementById("search");
const importBtn = document.querySelector(".import-btn");
const exportBtn = document.querySelector(".export-btn");
const importFile = document.getElementById("import-file");

if (false && navigator.serviceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw_cached_site.js")
      .then((reg) =>
        console.log(`Service Worker: Registered,  Scope is ${reg.scope}`)
      )
      .catch((err) => console.error(`Service Worker: Error ${err}`));
  });
}

class Note {
  name;
  content;

  constructor(name, content) {
    this.id = new Date().getTime().toString(16);
    this.name = name;
    this.content = content;
  }
}

let note = null;
let timeOut = null;
let searchTimeOut = null;

const SAVE_STATUS = {
  SAVING: "hsl(39, 100%, 50%)",
  SAVED: "hsl(120, 100%, 25%)",
};

console.log(localStorage.getItem("currentFileId"));

const currentFileId = localStorage.getItem("currentFileId");

if (currentFileId) {
  getNote(currentFileId).then((n) => {
    console.log("this", n);

    if (n) return openNoteInEditor(n);

    createNewFileAndOpen();
  });
} else {
  createNewFileAndOpen();
}

// initialize the file list in left panel
function updateFileList() {
  searchTimeOut = null;

  getAllNotes().then((allNotes) => {
    const query = searchElement.value.toLowerCase();

    const content = allNotes
      .filter((n) => {
        if (query === "") return true;

        return new RegExp(query).test(n.name.toLowerCase());
      })
      .reverse()
      .map((n) => {
        if (n.id === note.id) return createHTMLFile(n, true);

        return createHTMLFile(n);
      });

    filesContainer.innerHTML = "";

    content.forEach((c) => {
      filesContainer.appendChild(c);
    });
  });
}

updateFileList();
// ________________________________________________________________________

// ALL EVENT LISTENERS HERE....
searchElement.addEventListener("input", (e) => {
  if (searchTimeOut) clearTimeout(searchTimeOut);

  searchTimeOut = setTimeout(() => {
    updateFileList();
  }, 50);
});

addFileBtn.addEventListener("click", (e) => {
  createNewFileAndOpen();
  updateFileList();
});

backBtn.addEventListener("click", () => {
  save();
  appContainer.classList.add("left");
});

fileNameElement.addEventListener("input", function (e) {
  note.name = fileNameElement.value;

  const fileElement = document.querySelector(`p[data-note-id="${note.id}"]`);

  fileElement.innerHTML = `<span class="material-icons-round">description</span> ${fileNameElement.value}`;

  console.log(fileElement);

  setIndicatorStatusColor(SAVE_STATUS.SAVING);
  clearTimeoutIfExistAndCallSaveFunctionWithTimeout();
});

notepad.addEventListener("keydown", (e) => {
  if (e.key == "Tab") {
    e.preventDefault();
    var start = notepad.selectionStart;
    var end = notepad.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    notepad.value =
      notepad.value.substring(0, start) + "\t" + notepad.value.substring(end);

    // put caret at right position again
    notepad.selectionStart = notepad.selectionEnd = start + 1;
  }
});

notepad.addEventListener("input", (e) => {
  note.content = notepad.value;

  // _______________ AUTO GROW TEXTAREA HEIGHT___________
  // notepad.style.height = "5px";
  // notepad.style.height = notepad.scrollHeight + "px";
  // -------------------------------------------------------

  setIndicatorStatusColor(SAVE_STATUS.SAVING);
  clearTimeoutIfExistAndCallSaveFunctionWithTimeout();
});

currentDeleteBtn.addEventListener("click", async () => {
  await deleteAndUpdateEnvironment(note.id);
  appContainer.classList.add("left");
});

exportBtn.addEventListener("click", () => {
  save();
  exportData();
});

importBtn.addEventListener("click", () => {
  if (typeof window.FileReader !== "function") {
    alert("The file API isn't supported on this browser yet.");
    return;
  }

  importFile.click();
});

importFile.addEventListener("input", (e) => {
  var file, fr;

  if (!importFile) {
    alert("Um, couldn't find the fileinput element.");
  } else if (!importFile.files) {
    alert(
      "This browser doesn't seem to support the `files` property of file inputs."
    );
  } else if (!importFile.files[0]) {
    alert("Please select a file before clicking 'Load'");
  } else {
    file = importFile.files[0];
    fr = new FileReader();
    fr.onload = receivedText;
    fr.readAsText(file);
  }

  function receivedText(e) {
    let lines = e.target.result;
    var newArr = JSON.parse(lines);

    importData(newArr);
  }
});

// __________________________________________________________________________________

function save() {
  addOrUpdateNote(note)
    .then(() => {
      timeOut = null;
      setIndicatorStatusColor(SAVE_STATUS.SAVED);
    })
    .catch((err) => {
      console.log(err);
    });
}

function createHTMLFile(localNote, selected = false) {
  // _____________div _____________________
  const div = document.createElement("div");
  div.classList.add("file");
  div.setAttribute("data-note-id", localNote.id);
  div.setAttribute("data-selected", selected);

  div.addEventListener("click", async () => {
    console.log("clicked");
    save();

    const updatedNote = await getNote(localNote.id);
    openNoteInEditor(updatedNote);
    checkAndRemoveClass(appContainer, "left");

    updateFileList();
  });

  // ________________ p ___________________
  const p = document.createElement("p");
  p.innerHTML = `<span class="material-icons-round">🗎</span><span>${localNote.name}</span>`;
  p.setAttribute("data-note-id", localNote.id);

  // _______________button__________________
  const button = document.createElement("button");
  button.innerHTML = '<span class="material-icons-round">x</span>';
  button.classList.add(...["delete-btn", "remove-btn-style"]);
  button.setAttribute("data-note-id", localNote.id);

  button.addEventListener("click", async (e) => {
    e.stopPropagation(); // to prevent the event bubbling triggering event on th div

    // delete the file
    await deleteAndUpdateEnvironment(localNote.id);
  });

  div.appendChild(p);
  div.appendChild(button);

  return div;
}

async function deleteAndUpdateEnvironment(id) {
  await deleteNote(id);

  const count = await getTotalFiles();
  console.log(count);
  console.log("local note", id);
  console.log("note", note.id);

  if (count === 0) createNewFileAndOpen();
  else if (id === note.id) {
    const firstNote = await getFileByIndex(count - 1);

    openNoteInEditor(firstNote);
  }

  updateFileList();
}

function checkAndRemoveClass(element, className) {
  if (element.classList.contains(className))
    element.classList.remove(className);
}

function createNewFileAndOpen() {
  setIndicatorStatusColor(SAVE_STATUS.SAVING);
  getAllNotes().then((allNotes) => {
    const sortedFiles = allNotes
      .filter((n) => {
        return /untitled-\d+/.test(n.name);
      })
      .sort((a, b) => {
        const aNum = a.name.match(/untitled-(\d+)/)[1];
        const bNum = b.name.match(/untitled-(\d+)/)[1];

        return bNum - aNum;
      });

    const lastFileNumber =
      sortedFiles.length !== 0
        ? sortedFiles[0].name.match(/untitled-(\d+)/)[1]
        : 0;

    console.log(lastFileNumber);

    openNoteInEditor(new Note(`untitled-${Number(lastFileNumber) + 1}`, ""));
    save();
    updateFileList();
  });
}
/**
 *
 * @param {Note} n note object
 */
function openNoteInEditor(n) {
  console.log("global note", n.id);
  note = n; // set the global note object
  fileNameElement.value = n.name;
  notepad.value = n.content;
  notepad.focus();
  localStorage.setItem("currentFileId", n.id);
}

function setIndicatorStatusColor(color) {
  indicator.style.backgroundColor = color;
}

function clearTimeoutIfExistAndCallSaveFunctionWithTimeout() {
  if (timeOut) clearTimeout(timeOut);

  timeOut = setTimeout(() => {
    save();
  }, 1000);
}

function exportData() {
  getAllNotes().then((allNotes) => {
    const data = JSON.stringify(allNotes);
    const exportName = "notes";
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
    var downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
}

async function importData(notes) {
  console.log(notes);

  for (let i = 0; i < notes.length; i++) {
    const n = new Note(notes[i].name, notes[i].content);
    await addOrUpdateNote(n);
  }

  updateFileList();
}
