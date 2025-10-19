import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, query, updateDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDv7RaaIPxw06aZ4Ney5fvXiKuPmeEkcMY",
  authDomain: "gerenciador-clientes-bf830.firebaseapp.com",
  projectId: "gerenciador-clientes-bf830",
  storageBucket: "gerenciador-clientes-bf830.appspot.com",
  messagingSenderId: "181015968956",
  appId: "1:181015968956:web:99f4d538388a21db2b24b9",
  measurementId: "G-B03W0MEQPK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let userId = null;
let clientsCollectionRef = null;
let unsubscribe = null;
let allClients = [];
let confirmAction = null;
let currentClientForDoc = null;
let currentDocTypeForDoc = null;
let currentClientForFiles = null;

// --- ELEMENTOS DA UI ---
const authSection = document.getElementById('auth-section');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authErrorP = document.getElementById('auth-error');
const form = document.getElementById('add-client-form');
const submitButton = document.getElementById('submit-button');
const searchInput = document.getElementById('search-input');
const clientsListDiv = document.getElementById('clients-list');
const statusWrapper = document.getElementById('status-wrapper');
const trashBtn = document.getElementById('trash-btn');
const trashListDiv = document.getElementById('trash-list');

// --- FUNÇÕES GLOBAIS ---
function formatCurrency(value) {
    const number = parseFloat(value) || 0;
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function resetFormState() {
    form.reset();
    form.querySelector('[name="clientId"]').value = '';
    document.getElementById('form-title').textContent = "Adicionar Nova Cliente";
    statusWrapper.classList.add('hidden');
    submitButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /></svg>
        Salvar Cliente
    `;
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

window.closeModal = function(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function fetchAddress(cep) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
        return;
    }
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
            console.log('CEP não encontrado.');
            form.querySelector('input[name="endereco"]').value = '';
            form.querySelector('input[name="bairro"]').value = '';
            form.querySelector('input[name="cidade"]').value = '';
            form.querySelector('input[name="uf"]').value = '';
        } else {
            form.querySelector('input[name="endereco"]').value = data.logradouro;
            form.querySelector('input[name="bairro"]').value = data.bairro;
            form.querySelector('input[name="cidade"]').value = data.localidade;
            form.querySelector('input[name="uf"]').value = data.uf;
            form.querySelector('input[name="numero"]').focus();
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    }
}

function applyInputMasks() {
    const currencyInput = document.querySelector('input[name="valor_beneficio"]');
    const dateInputs = document.querySelectorAll('input[name="data_nascimento"], input[name="exp"], input[name="data_registro"], input[name="nasc_bebe"], input[name="data_adim"], input[name="data_demiss"]');
    const phoneInput = document.querySelector('input[name="fone"]');
    const cepInput = document.querySelector('input[name="cep"]');
    const ufInput = document.querySelector('input[name="uf"]');
    const cpfInput = document.querySelector('input[name="cpf"]');
    const orgaoExpedidorInput = document.querySelector('input[name="orgao_expedidor"]');
    const numericOnlyInputs = document.querySelectorAll('input[name="numero"]');
    const textInputsToCapitalize = document.querySelectorAll('input[name="nome_completo"], input[name="endereco"], input[name="bairro"], input[name="cidade"], input[name="nome_do_pai"], input[name="nome_da_mae"], input[name="profissao"], input[name="divulgador"], input[name="nacionalidade"], input[name="natural"]');

    const applyMask = (input, maskFunction) => {
        if (input) input.addEventListener('input', (e) => {
            e.target.value = maskFunction(e.target.value);
        });
    };
    
    if (currencyInput) {
        currencyInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = (parseInt(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (value === "NaN" || value === "0,00") value = "";
            e.target.value = value;
        });
    }

    dateInputs.forEach(input => applyMask(input, value => {
        value = value.replace(/\D/g, '');
        if (value.length > 4) return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4, 8)}`;
        if (value.length > 2) return `${value.slice(0, 2)}/${value.slice(2)}`;
        return value;
    }));

    applyMask(phoneInput, value => {
        value = value.replace(/\D/g, '');
        if (value.length > 10) return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
        if (value.length > 2) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
        if (value.length > 0) return `(${value.slice(0, 2)}`;
        return value;
    });

    applyMask(cepInput, value => {
        value = value.replace(/\D/g, '');
        if (value.length > 5) return `${value.slice(0, 5)}-${value.slice(5, 8)}`;
        return value;
    });

    if (cepInput) {
        cepInput.addEventListener('blur', (e) => fetchAddress(e.target.value));
    }

    applyMask(ufInput, value => value.toUpperCase());
    applyMask(orgaoExpedidorInput, value => value.toUpperCase());
    
    applyMask(cpfInput, value => {
        value = value.replace(/\D/g, '');
        if (value.length > 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9, 11)}`;
        if (value.length > 6) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
        if (value.length > 3) return `${value.slice(0, 3)}.${value.slice(3)}`;
        return value;
    });
    
    numericOnlyInputs.forEach(input => applyMask(input, value => value.replace(/\D/g, '')));
    
    textInputsToCapitalize.forEach(input => applyMask(input, value => {
        if (input.name === 'profissao' && value.trim().toLowerCase() === 'do lar') {
            return 'do Lar';
        }
        if (input.name === 'nacionalidade' && (value.trim().toLowerCase() === 'brasileira' || value.trim().toLowerCase() === 'brasileiro')) {
            return value.toLowerCase();
        }
        const exceptions = ['de', 'da', 'do', 'dos', 'das'];
        const singleVowelExceptions = ['a', 'e', 'o', 'u'];
        return value
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
                if (word.length === 0) return '';
                if (index > 0 && (exceptions.includes(word) || singleVowelExceptions.includes(word))) {
                    return word;
                }
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    }));
}

function updateDashboard(clients) {
    document.getElementById('total-clients').textContent = clients.filter(c => !c.deleted).length;
    document.getElementById('pending-clients').textContent = clients.filter(c => !c.deleted && c.status === 'Pendente').length;
    document.getElementById('analysis-clients').textContent = clients.filter(c => !c.deleted && c.status === 'Em Análise').length;
    document.getElementById('completed-clients').textContent = clients.filter(c => !c.deleted && c.status === 'Concluído').length;

    let aReceber = 0;
    let recebido = 0;
    clients.forEach(client => {
        if (!client.deleted && client.valor_beneficio) {
            const valor = parseFloat(String(client.valor_beneficio).replace(/\./g, '').replace(',', '.')) || 0;
            const honorarios = valor * 0.30;
            if (client.status_pagamento === 'Pago') {
                recebido += honorarios;
            } else {
                aReceber += honorarios;
            }
        }
    });
    document.getElementById('total-a-receber').textContent = formatCurrency(aReceber);
    document.getElementById('total-recebido').textContent = formatCurrency(recebido);
}

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        userEmailSpan.textContent = user.email;
        authSection.classList.add('hidden');
        appContent.classList.remove('hidden');

        clientsCollectionRef = collection(db, `users/${userId}/clientes`);
        fetchClients();
        applyInputMasks();
    } else {
        userId = null;
        authSection.classList.remove('hidden');
        appContent.classList.add('hidden');
        if (unsubscribe) unsubscribe();
        clientsListDiv.innerHTML = '<p class="text-slate-500">Faça login para ver os clientes.</p>';
    }
});

// --- LÓGICA DE DADOS (CLIENTES) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const clientData = {};
    formData.forEach((value, key) => { 
        const input = form.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
            clientData[key] = input.checked;
        } else {
            clientData[key] = value;
        }
    });
    
    const clientId = clientData.clientId;
    const clientCpf = (clientData.cpf || '').replace(/\D/g, '');

    if (clientCpf) {
        const isDuplicate = allClients.filter(c => !c.deleted).some(client => {
            const existingCpf = (client.cpf || '').replace(/\D/g, '');
            return existingCpf === clientCpf && client.id !== clientId;
        });

        if (isDuplicate) {
            document.getElementById('duplicate-warning-modal').classList.remove('hidden');
            return;
        }
    }
    
    const newNote = clientData.new_note ? clientData.new_note.trim() : '';
    delete clientData.new_note;
    delete clientData.clientId;

    try {
        if (clientId) {
            const clientRef = doc(db, `users/${userId}/clientes`, clientId);
            const existingClient = allClients.find(c => c.id === clientId);
            let notes = existingClient.notes || [];
            if (newNote) {
                notes.unshift({ text: newNote, date: new Date().toISOString() });
            }
            clientData.notes = notes;
            await updateDoc(clientRef, clientData);
        } else {
            clientData.createdAt = new Date().toISOString();
            clientData.status = "Pendente"; 
            clientData.notes = newNote ? [{ text: newNote, date: new Date().toISOString() }] : [];
            clientData.files = []; 
            clientData.deleted = false;
            clientData.valor_beneficio = clientData.valor_beneficio || '0';
            clientData.status_pagamento = clientData.status_pagamento || 'A Aguardar Pagamento';
            await addDoc(clientsCollectionRef, clientData);
        }
        resetFormState();
    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
    }
});

function fetchClients() {
     if (unsubscribe) unsubscribe();
     if (!clientsCollectionRef) {
         clientsListDiv.innerHTML = '';
         return;
     };
     const q = query(clientsCollectionRef);
     unsubscribe = onSnapshot(q, (snapshot) => {
         allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         renderClients(allClients.filter(c => !c.deleted));
         updateDashboard(allClients);
     }, (error) => console.error("Erro ao buscar clientes:", error));
}

// --- RENDERIZAÇÃO E UI ---
function renderClients(clients) {
    clientsListDiv.innerHTML = '';
    if (clients.length === 0) {
        clientsListDiv.innerHTML = '<p class="text-slate-500">Nenhum cliente encontrado.</p>';
        return;
    }

    clients.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    const statusColors = {
        "Pendente": "bg-yellow-100 text-yellow-800",
        "Em Análise": "bg-blue-100 text-blue-800",
        "Concluído": "bg-green-100 text-green-800",
    };

    clients.forEach(client => {
        const status = client.status || 'Pendente';
        const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
        
        let notesHtml = '';
        if (client.notes && client.notes.length > 0) {
            notesHtml = '<div class="mt-4 pt-4 border-t space-y-2">';
            client.notes.forEach(note => {
                const noteDate = new Date(note.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                notesHtml += `
                    <div class="text-sm p-2 bg-slate-100 rounded">
                        <p class="font-semibold text-slate-600">${noteDate}</p>
                        <p class="text-slate-800">${note.text}</p>
                    </div>
                `;
            });
            notesHtml += '</div>';
        }

        const clientCard = document.createElement('div');
        clientCard.className = 'bg-slate-50 p-4 rounded-lg border';
        clientCard.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold text-lg text-slate-800">${client.nome_completo || 'Nome não informado'}</p>
                    <p class="text-sm text-slate-500">${client.cpf || 'CPF não informado'}</p>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full ${colorClass}">${status}</span>
            </div>
             <div class="mt-2 text-sm text-slate-600">
                <p><strong>Honorários:</strong> ${formatCurrency((parseFloat(String(client.valor_beneficio || '0').replace(/\./g, '').replace(',', '.')) || 0) * 0.30)}</p>
                <p><strong>Pagamento:</strong> ${client.status_pagamento || 'A Aguardar'}</p>
            </div>
            ${notesHtml}
            <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                <button data-client-id="${client.id}" class="edit-btn bg-white border border-slate-300 text-slate-600 font-semibold py-2 px-3 rounded-md hover:bg-slate-100 text-sm">Editar</button>
                <button data-client-id="${client.id}" class="files-btn bg-teal-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-teal-600 text-sm">Ver/Anexar</button>
                <button data-client-id="${client.id}" data-doc-type="ficha" class="generate-btn bg-white border border-slate-300 text-slate-600 font-semibold py-2 px-3 rounded-md hover:bg-slate-100 text-sm">Ficha Cadastral</button>
                <button data-client-id="${client.id}" data-doc-type="contrato_procuracao" class="generate-btn bg-blue-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-blue-600 text-sm">Contrato e Procuração</button>
                <button data-client-id="${client.id}" data-doc-type="somente_contrato" class="generate-btn bg-indigo-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-indigo-600 text-sm">Somente Contrato</button>
                <button data-client-id="${client.id}" data-doc-type="procuracao" class="generate-btn bg-purple-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-purple-600 text-sm">Somente Procuração</button>
                <button data-client-id="${client.id}" data-doc-type="procuracao_gerid" class="generate-btn bg-cyan-500 text-white font-semibold py-2 px-3 rounded-md hover:bg-cyan-600 text-sm">Procuração GERID</button>
                <button data-client-id="${client.id}" data-client-name="${client.nome_completo}" class="delete-btn text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 ml-auto">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
            </div>
        `;
        clientsListDiv.appendChild(clientCard);

        clientCard.querySelector('.delete-btn').addEventListener('click', (e) => openMoveToTrashConfirmModal(e.currentTarget.dataset.clientId, e.currentTarget.dataset.clientName));
        clientCard.querySelector('.edit-btn').addEventListener('click', (e) => populateFormForEdit(e.currentTarget.dataset.clientId));
        clientCard.querySelector('.files-btn').addEventListener('click', (e) => openFilesModal(e.currentTarget.dataset.clientId));
        clientCard.querySelectorAll('.generate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const clientData = allClients.find(c => c.id === btn.dataset.clientId);
                generateDocument(clientData, btn.dataset.docType);
            });
        });
    });
}

// --- MÉTODOS DE CONTROLO ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authErrorP.textContent = '';
    } catch (error) {
        authErrorP.textContent = "E-mail ou senha inválidos.";
        console.error("Erro de login:", error);
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        authErrorP.textContent = '';
    } catch (error) {
        authErrorP.textContent = "Erro ao criar conta. Verifique o e-mail e a senha.";
        console.error("Erro de registo:", error);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

toggleAuthModeBtn.addEventListener('click', () => {
    const isLogin = !loginForm.classList.contains('hidden');
    if (isLogin) {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        toggleAuthModeBtn.textContent = "Já tenho uma conta. Entrar";
        document.getElementById('auth-title').textContent = "Crie a sua conta";
    } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        toggleAuthModeBtn.textContent = "Criar uma conta nova";
        document.getElementById('auth-title').textContent = "Login / Entrar";
    }
});

document.getElementById('cancel-edit-btn').addEventListener('click', resetFormState);
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (!searchTerm) {
        renderClients(allClients.filter(c => !c.deleted));
        return;
    }
    const filteredClients = allClients.filter(client => {
        if (client.deleted) return false;
        const name = (client.nome_completo || '').toLowerCase();
        const cpf = (client.cpf || '').replace(/\D/g, '');
        return name.includes(searchTerm) || cpf.includes(searchTerm.replace(/\D/g, ''));
    });
    renderClients(filteredClients);
});

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if(confirmAction) {
        await confirmAction();
    }
    confirmAction = null;
    closeModal('delete-confirm-modal');
});

function populateFormForEdit(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    form.querySelector('[name="clientId"]').value = client.id;
    for (const key in client) {
        const input = form.querySelector(`[name="${key}"]`);
         if (input) {
            if(input.type === 'checkbox') {
                input.checked = client[key];
            } else if (key !== 'notes') {
                input.value = client[key];
            }
        }
    }
    
    statusWrapper.classList.remove('hidden');
    document.getElementById('form-title').textContent = "Editar Cliente";
    submitButton.innerHTML = "Atualizar Cliente";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMoveToTrashConfirmModal(clientId, clientName) {
    document.getElementById('delete-confirm-text').textContent = `Tem certeza que deseja mover "${clientName}" para a lixeira?`;
    document.getElementById('confirm-delete-btn').textContent = 'Mover para Lixeira';
    
    confirmAction = async () => {
        const clientRef = doc(db, `users/${userId}/clientes`, clientId);
        await updateDoc(clientRef, { deleted: true });
    };

    document.getElementById('delete-confirm-modal').classList.remove('hidden');
    document.getElementById('delete-confirm-modal').classList.add('flex');
}

function openPermanentDeleteConfirmModal(clientId, clientName) {
    document.getElementById('delete-confirm-text').textContent = `Tem certeza que deseja excluir PERMANENTEMENTE "${clientName}"? Todos os seus dados e anexos serão apagados para sempre.`;
    document.getElementById('confirm-delete-btn').textContent = 'Excluir Permanentemente';

    confirmAction = async () => {
        const clientData = allClients.find(c => c.id === clientId);
        if (clientData && clientData.files && clientData.files.length > 0) {
            for (const file of clientData.files) {
                const fileRef = ref(storage, file.path);
                await deleteObject(fileRef).catch(e => console.error("Erro ao apagar ficheiro do storage", e));
            }
        }
        await deleteDoc(doc(db, `users/${userId}/clientes`, clientId));
        closeModal('trash-modal');
    };

    document.getElementById('delete-confirm-modal').classList.remove('hidden');
    document.getElementById('delete-confirm-modal').classList.add('flex');
}

function openDeleteFileConfirmModal(filePath, fileName, client) {
     document.getElementById('delete-confirm-text').textContent = `Tem certeza que deseja apagar o ficheiro "${fileName}"?`;
    document.getElementById('confirm-delete-btn').textContent = 'Excluir Ficheiro';
    
    confirmAction = async () => {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);

        const clientRef = doc(db, `users/${userId}/clientes`, client.id);
        const updatedFiles = client.files.filter(f => f.path !== filePath);
        await updateDoc(clientRef, { files: updatedFiles });
    };

    document.getElementById('delete-confirm-modal').classList.remove('hidden');
    document.getElementById('delete-confirm-modal').classList.add('flex');
}

// --- GESTÃO DE FICHEIROS/ANEXOS ---
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-upload');
const filesListDiv = document.getElementById('files-list');
const progressContainer = document.getElementById('upload-progress-container');
const progressBar = document.getElementById('upload-progress-bar');

function openFilesModal(clientId) {
    currentClientForFiles = allClients.find(c => c.id === clientId);
    if (!currentClientForFiles) return;
    document.getElementById('files-modal-title').textContent = `Anexos de ${currentClientForFiles.nome_completo}`;
    renderFilesList(currentClientForFiles);
    document.getElementById('files-modal').classList.remove('hidden');
    document.getElementById('files-modal').classList.add('flex');
}

uploadBtn.addEventListener('click', () => {
    const files = fileInput.files;
    if (files.length === 0 || !currentClientForFiles) return;
    handleFileUpload(files, currentClientForFiles);
});

async function handleFileUpload(files, client) {
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    const filesToUpload = Array.from(files);
    for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const filePath = `users/${userId}/clientes/${client.id}/${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);
        await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressBar.style.width = progress + '%';
                }, 
                (error) => {
                    console.error("Erro no upload:", error);
                    reject(error);
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const clientRef = doc(db, `users/${userId}/clientes`, client.id);
                    const updatedClientData = allClients.find(c => c.id === client.id);
                    const updatedFiles = updatedClientData.files || [];
                    if (!updatedFiles.some(f => f.path === filePath)) {
                        updatedFiles.push({ name: file.name, url: downloadURL, path: filePath });
                        await updateDoc(clientRef, { files: updatedFiles });
                    }
                    resolve();
                }
            );
        });
    }
    fileInput.value = '';
    progressContainer.classList.add('hidden');
}

function renderFilesList(client) {
    const files = client.files || [];
    filesListDiv.innerHTML = '';
    if (!files || files.length === 0) {
        filesListDiv.innerHTML = '<p class="text-slate-500">Nenhum anexo encontrado.</p>';
        return;
    }
    files.forEach(file => {
        const fileEl = document.createElement('div');
        fileEl.className = 'flex justify-between items-center bg-slate-100 p-2 rounded';
        fileEl.innerHTML = `
            <a href="${file.url}" target="_blank" class="text-blue-600 hover:underline">${file.name}</a>
            <button data-file-path="${file.path}" data-file-name="${file.name}" class="delete-file-btn text-red-500 hover:text-red-700">&times;</button>
        `;
        filesListDiv.appendChild(fileEl);
        fileEl.querySelector('.delete-file-btn').addEventListener('click', async (e) => {
            const { filePath, fileName } = e.currentTarget.dataset;
            openDeleteFileConfirmModal(filePath, fileName, client);
        });
    });
}

// --- LIXEIRA ---
trashBtn.addEventListener('click', () => {
    const deletedClients = allClients.filter(c => c.deleted);
    renderTrashList(deletedClients);
    document.getElementById('trash-modal').classList.remove('hidden');
    document.getElementById('trash-modal').classList.add('flex');
});

function renderTrashList(deletedClients) {
    trashListDiv.innerHTML = '';
    if (deletedClients.length === 0) {
        trashListDiv.innerHTML = '<p class="text-slate-500">A lixeira está vazia.</p>';
        return;
    }
    deletedClients.forEach(client => {
        const trashItem = document.createElement('div');
        trashItem.className = 'flex justify-between items-center bg-slate-100 p-2 rounded';
        trashItem.innerHTML = `
            <div>
                <p class="font-semibold">${client.nome_completo}</p>
                <p class="text-sm text-slate-500">${client.cpf}</p>
            </div>
            <div class="space-x-2">
                <button data-id="${client.id}" class="restore-btn text-green-600 hover:text-green-800">Restaurar</button>
                <button data-id="${client.id}" data-name="${client.nome_completo}" class="perm-delete-btn text-red-600 hover:text-red-800">Excluir</button>
            </div>
        `;
        trashListDiv.appendChild(trashItem);
    });

    trashListDiv.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const clientRef = doc(db, `users/${userId}/clientes`, id);
            await updateDoc(clientRef, { deleted: false });
            closeModal('trash-modal');
        });
    });

    trashListDiv.querySelectorAll('.perm-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openPermanentDeleteConfirmModal(e.currentTarget.dataset.id, e.currentTarget.dataset.name);
        });
    });
}

// --- GERAÇÃO DE DOCUMENTOS (PDF) ---
document.getElementById('print-btn').addEventListener('click', () => window.print());

function generateDocument(client, type) {
    currentClientForDoc = client;
    currentDocTypeForDoc = type;
    const docModal = document.getElementById('document-modal');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    
    modalContent.innerHTML = '';

    if (type === 'ficha') {
        modalTitle.textContent = `Ficha Cadastral - ${client.nome_completo}`;
        modalContent.innerHTML = getFichaHtml(client);
    } else if (type === 'contrato_procuracao') {
        modalTitle.textContent = `Contrato e Procuração - ${client.nome_completo}`;
        modalContent.innerHTML = getContratoProcuracaoHtml(client);
    } else if (type === 'somente_contrato') {
        modalTitle.textContent = `Contrato - ${client.nome_completo}`;
        modalContent.innerHTML = getSomenteContratoHtml(client);
    } else if (type === 'procuracao') {
        modalTitle.textContent = `Procuração - ${client.nome_completo}`;
        modalContent.innerHTML = getProcuracaoHtml(client);
    } else if (type === 'procuracao_gerid') {
        modalTitle.textContent = `Procuração GERID - ${client.nome_completo}`;
        modalContent.innerHTML = getProcuracaoGeridHtml(client);
    }
    docModal.classList.remove('hidden');
    docModal.classList.add('flex');
}

function getFichaHtml(client) {
    const ec = client.estado_civil || '';
    const saiuGravida = client.saiu_gravida || '';
    const seguro = client.seguro_desemprego || '';
    const vinculos = client.vinculos || '';
    const tipoDemissao = client.tipo_demissao || '';
    
    let bebeStatus = '';
    if (!client.nasc_bebe && !client.data_registro) {
        bebeStatus = ' (Grávida)';
    } else if (client.nasc_bebe && !client.data_registro) {
        bebeStatus = ' (Esperando registro do bebe)';
    }

    let notesContent = '';
    if (client.notes && client.notes.length > 0) {
        notesContent = `
            <hr class="col-span-2 my-2 border-t border-slate-300">
            <div class="col-span-2">
                <strong>Observações:</strong>
                ${client.notes.map(note => `<p>${note.text}</p>`).join('')}
            </div>
        `;
    }
    let checkBoxes = `
        <div class="col-span-2 grid grid-cols-4 gap-4 pt-2 border-t mt-2">
            <p><strong>SIRC:</strong> (${client.sirc ? 'X' : '&nbsp;'})</p>
            <p><strong>TRAVA:</strong> (${client.trava ? 'X' : '&nbsp;'})</p>
            <p><strong>SINE:</strong> (${client.sine ? 'X' : '&nbsp;'})</p>
            <p><strong>CNIS:</strong> (${client.cnis_check ? 'X' : '&nbsp;'})</p>
        </div>
    `;
    return `
        <h2 class="text-xl mb-6">FICHA CADASTRAL</h2>
        <div style="font-size: 11pt; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25rem 1rem; line-height: 1.5;">
            <p><strong>Divulgador:</strong> ${client.divulgador || ''}</p>
            <p><strong>Senha CNIS:</strong> ${client.senha_cnis || ''}</p>
            ${checkBoxes}
            <p class="col-span-2"><strong>Nome Completo:</strong> ${client.nome_completo || ''}<strong>${bebeStatus}</strong></p>
            <p><strong>Data de Nascimento:</strong> ${client.data_nascimento || ''}</p>
            <p><strong>CPF:</strong> ${client.cpf || ''}</p>
            <p><strong>RG:</strong> ${client.rg || ''} / ${client.orgao_expedidor || ''}</p>
            <p><strong>Expedição:</strong> ${client.exp || ''}</p>
            <p><strong>NIT/PIS/PASEP:</strong> ${client.nit || ''}</p>
            <p><strong>Título de Eleitor:</strong> ${client.titulo || ''}</p>
            <p class="col-span-2"><strong>Nome da Mãe:</strong> ${client.nome_da_mae || ''}</p>
            <p class="col-span-2"><strong>Nome do Pai:</strong> ${client.nome_do_pai || ''}</p>
            <p><strong>Nacionalidade:</strong> ${client.nacionalidade || ''}</p>
            <p><strong>Naturalidade:</strong> ${client.natural || ''}</p>
            <p><strong>Escolaridade:</strong> ${client.escola || ''}</p>
            <p class="col-span-2"><strong>Estado Civil:</strong> 
                (${ec === 'casada' ? 'X' : '&nbsp;'}) casada 
                (${ec === 'solteira' ? 'X' : '&nbsp;'}) solteira 
                (${ec === 'viuva' ? 'X' : '&nbsp;'}) viúva 
                (${ec === 'separada' ? 'X' : '&nbsp;'}) separada 
                (${ec === 'divorciada' ? 'X' : '&nbsp;'}) divorciada
            </p>
            <p class="col-span-2"><strong>Endereço:</strong> ${client.endereco || ''}, ${client.numero || ''}</p>
            <p><strong>Bairro:</strong> ${client.bairro || ''}</p>
            <p><strong>Cidade/UF:</strong> ${client.cidade || ''} / ${client.uf || ''}</p>
            <p><strong>CEP:</strong> ${client.cep || ''}</p>
            <p><strong>Telefone:</strong> ${client.fone || ''}</p>
            <p class="col-span-2"><strong>E-mail:</strong> ${client.email || ''}</p>
            <hr class="col-span-2 my-2 border-t border-slate-300">
            <p><strong>Data de Admissão:</strong> ${client.data_adim || ''}</p>
            <p><strong>Data de Demissão:</strong> ${client.data_demiss || ''}</p>
            <p class="col-span-2"><strong>Tipo de Demissão:</strong> 
                (${tipoDemissao === 'pediu' ? 'X' : '&nbsp;'}) Pediu demissão
                (${tipoDemissao === 'foi demitida' ? 'X' : '&nbsp;'}) Foi demitida
                (${tipoDemissao === 'justa causa' ? 'X' : '&nbsp;'}) Justa causa
            </p>
            <p><strong>Vínculos:</strong> 
                (${vinculos === 'aberto' ? 'X' : '&nbsp;'}) Aberto
                (${vinculos === 'fechado' ? 'X' : '&nbsp;'}) Fechado
            </p>
            <p><strong>Seguro Desemprego:</strong> 
                (${seguro === 'sim' ? 'X' : '&nbsp;'}) Sim
                (${seguro === 'nao' ? 'X' : '&nbsp;'}) Não
            </p>
            <hr class="col-span-2 my-2 border-t border-slate-300">
            <p><strong>Data Nascimento Bebê:</strong> ${client.nasc_bebe || ''}</p>
            <p><strong>Data Registro Bebê:</strong> ${client.data_registro || ''}</p>
            <p><strong>Nº Matrícula Bebê:</strong> ${client.n_matricula || ''}</p>
            <p class="col-span-2"><strong>Saiu grávida:</strong> 
                (${saiuGravida === 'sim' ? 'X' : '&nbsp;'}) Sim
                (${saiuGravida === 'nao' ? 'X' : '&nbsp;'}) Não
            </p>
            ${notesContent}
        </div>
    `;
}

function getSomenteContratoHtml(client) {
    const today = new Date();
    const longFormattedDate = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const enderecoCompleto = `${client.endereco || ''}, nº ${client.numero || ''}, Bairro ${client.bairro || ''}, ${client.cidade || ''}-${client.uf || ''}, CEP: ${client.cep || ''}`;
    return `
        <div>
            <h3 class="text-lg mb-4">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h3>
            <p class="mb-2"><strong>CONTRATADA:</strong> RS'MATERNIDADE, de FONE 51-99503-3982 e CNPJ 33.501.519/0001-02 estabelecida na Rua Marcilio Dias, nº 1261, sala 705, bairro centro na cidade de Novo Hamburgo-RS, CEP: 93410-177; e do outro lado a <strong>CONTRATANTE</strong>, ${client.nome_completo || ''}, ${client.nacionalidade || 'brasileira'}, ${client.estado_civil || ''}, ${client.profissao || ''}, CPF: ${client.cpf || ''}, residente na ${enderecoCompleto}.</p>
            <p class="mb-2">As partes acima identificadas têm, entre si, justas e acertadas o presente Contrato de Prestação de Serviços, que se regera pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descrito no presente.</p>
            <p class="mb-2"><strong>CLÁUSULA 1º:</strong> É objetivo do presente contrato, a prestação de serviço do CONTRATADO para representar o contratante no encaminhamento de um direito mantido pela seguridade social – SALÁRIO MATERNIDADE, a fim de oportunizar o recebimento de valores aproximadamente equivalentes a média aritmética simples das 12 (doze) ultimas remunerações, oficialmente obtidas em virtude do último contrato de emprego analítico analisado, multiplicando por 4 (quatro), executando-se para esse fim o 13º (décimo terceiro salário), salvo eventual mudança da legislação. Uma vez que, que não é permitido o valor obtido seja inferior ao salário mínimo, o mesmo será equipado ao salário mínimo vigente do ano base das remunerações utilizadas para o cálculo, mais a correção monetária. Sendo o benefício concedido, fica ciente o CONTRATANTE que o depósito será feito em uma agência bancária indicada pela previdência social.</p>
            <p class="mb-2"><strong>CLÁUSULA 2º:</strong> O CONTRATANTE deverá fornecer ao CONTRATADO todas as informações e documentos originais ou autenticados necessárias para a realização do serviço, havendo a garantia documentada de receber os documentos fornecidos nas mesmas condições em que se encontram no final da prestação do serviço.</p>
            <p class="mb-2"><strong>CLÁUSULA 3º:</strong> Ambas as partes declaram, que o valor obtido em virtude desta contratação/serviço, será recebido exclusivamente em conjunto, ambos comparecendo no mesmo dia e horário na agência bancária respectiva para o recebimento do direito objeto deste contrato, conforme aviso prévio do CONTRATADO. Momento no qual o serviço do CONTRATADO será pago em uma única parcela, pois entregara a documentação necessária para a efetivação do recebimento dos valores e documentos que estiverem em sua posse, conforme cláusula SEGUNDA.</p>
            <p class="mb-2"><strong>CLÁUSULA 4º:</strong> O presente serviço será remunerado em 30% dos valores brutos obtidos para a beneficiada pelo valor mínimo constante na primeira cláusula. Para valores obtidos acima da média do salário mínimo vigente, o serviço também será remunerado em 30% dos valores brutos obtidos, em uma única parcela e sem qualquer espécie de desconto.</p>
            <p class="mb-2"><strong>CLÁUSULA 5º:</strong> Em caso de quebra de contrato na parte do CONTRATANTE será cobrada a quantia de (2) dois salários mínimos vigentes mais honorários de advocacia, sendo imediatamente inscrito no SERVIÇO de PROTEÇÃO AO CREDITO (SPC) e em seguida movido uma ação judicial para cumprimento deste contrato.</p>
            <p class="mb-2"><strong>CLÁUSULA 6º:</strong> Caso a contratante não compareça no dia e local combinado a ser feito o pagamento, será cobrada uma multa de R$ 200,00 (DUZENTOS REAIS), com a finalidade de ressarcir gastos com deslocamento e pessoal.</p>
            <p class="mb-2"><strong>CLÁUSULA 7º:</strong> Fica eleito o Foro de Dois Irmãos/RS para dirimir quaisquer questões judiciais.</p>
            <p class="text-right mt-6 mb-8">Novo Hamburgo/RS, ${longFormattedDate}.</p>
            
            <div class="grid grid-cols-2 gap-4 text-center mt-8">
                <div><div class="signature-line w-full mx-auto" style="margin-top:0;"></div><p class="mt-1 text-sm">CONTRATADA</p><p class="text-sm">RS Assessoria Previdenciária</p></div>
                <div><div class="signature-line w-full mx-auto" style="margin-top:0;"></div><p class="mt-1 text-sm">CONTRATANTE</p><p class="text-sm">${client.nome_completo || ''}</p></div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-center mt-8">
                <div><div class="signature-line w-full mx-auto" style="margin-top:0;"></div><p class="mt-1 text-sm">TESTEMUNHA ( 01 )</p></div>
                <div><div class="signature-line w-full mx-auto" style="margin-top:0;"></div><p class="mt-1 text-sm">TESTEMUNHA ( 02 )</p></div>
            </div>
        </div>
    `;
}

function getContratoProcuracaoHtml(client) {
    return `
        ${getSomenteContratoHtml(client)}
        <div class="document-section-break"></div>
        ${getProcuracaoHtml(client)}
        <div class="document-section-break"></div>
        ${getProcuracaoGeridHtml(client)}
    `;
}

function getProcuracaoHtml(client) {
    const enderecoCompleto = `${client.endereco || ''}, nº ${client.numero || ''}, Bairro ${client.bairro || ''}, ${client.cidade || ''}-${client.uf || ''}, CEP: ${client.cep || ''}`;
    return `
        <div>
            <h3 class="text-lg mb-4">PROCURAÇÃO - A CARGO DO INSS</h3>
            <p><strong>Nome completo do segurado/pensionista:</strong> ${client.nome_completo || ''}</p>
            <p><strong>Nacionalidade:</strong> ${client.nacionalidade || 'brasileira'}, <strong>Estado Civil:</strong> ${client.estado_civil || ''}, <strong>Profissão:</strong> ${client.profissao || ''}</p>
            <p><strong>CPF:</strong> ${client.cpf || ''}</p>
            <p><strong>End.:</strong> ${enderecoCompleto}</p>
            <br>
            <p>Nomeia e constitui seu bastante procurador o(a) Sr.(a): <strong>Dirson Weiand</strong></p>
            <p><strong>Profissão:</strong> Despachante previdenciário, <strong>Nacionalidade:</strong> brasileiro, <strong>Estado Civil:</strong> Solteiro</p>
            <p><strong>CPF:</strong> 925.484.070-04, <strong>RG:</strong> 1069806253, <strong>NIT:</strong> 126.29572.71.6</p>
            <p>Rua Marcilio Dias, nº 1261 sala705, <strong>Bairro:</strong> Centro, <strong>Cidade:</strong> Novo Hamburgo, <strong>UF:</strong> RS</p>
            <br>
            <p>Nomeia e constitui seu bastante procurador o(a) Sr.(a): <strong>Giseli Ribeiro</strong></p>
            <p><strong>Profissão:</strong> Administrativo, <strong>Nacionalidade:</strong> Brasileira, <strong>Estado Civil:</strong> solteira</p>
            <p><strong>CPF:</strong> 962.685.900-82, <strong>RG:</strong> 9081845332</p>
            <p>Rua Marcilio Dias, nº 1261 sala 705, <strong>Bairro:</strong> Centro, <strong>Cidade:</strong> Novo Hamburgo, <strong>UF:</strong> RS</p>
            <br>
            <p>( &nbsp; ) Diversos ( X ) Requerer benefícios, revisão e interpor recursos: ( &nbsp; ) Ausente</p>
            <div style="margin-top: 2rem;">
                <div style="border-bottom: 1px solid black;"></div>
                <p style="text-align: center; margin-top: 4px;">Assinatura do segurado</p>
            </div>
            <h3 class="text-lg my-4" style="margin-top: 1.5rem;">TERMO DE RESPONSABILIDADE</h3>
            <p>Pelo presente termo de responsabilidade, comprometo-me a comunicar ao INSS qualquer evento que possa anular segurado/pensionista, mediante apresentação da respectiva. Estou ciente que o descumprimento do compromisso ora assumido, além de obrigar a devolução de importâncias recebidas indevidamente, quando for o caso, sujeitar-me às penalidade previstas nos artigos 171 e 299, ambos do Código Penal.</p>
            <br>
            <div style="margin-top: 1rem;">
                <div style="border-bottom: 1px solid black;"></div>
                <p style="text-align: center; margin-top: 4px;">Local e Data</p>
            </div>
            <br>
            <div style="margin-top: 1rem;">
                <div style="border-bottom: 1px solid black; width: 75%;"></div>
                <p style="text-align: left; margin-top: 4px;">Assinatura do Procurador</p>
            </div>
        </div>
    `;
}

function getProcuracaoGeridHtml(client) {
    const today = new Date();
    const longFormattedDate = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const enderecoCompleto = `${client.endereco || ''}, nº ${client.numero || ''}, Bairro ${client.bairro || ''}, na cidade de ${client.cidade || ''}(${client.uf || ''})`;
    const nacionalidade = client.nacionalidade || 'brasileira';

    return `
        <div>
            <h3 class="text-lg mb-4" style="text-align: center; font-weight: bold;">P R O C U R A Ç Ã O</h3>
            <p class="mb-2"><strong>OUTORGANTE:</strong> ${client.nome_completo || ''}, ${nacionalidade}, ${client.estado_civil || ''}, ${client.profissao || ''}, portadora da Carteira de Identidade nº ${client.rg || ''} e CPF nº ${client.cpf || ''}, residente e domiciliada na ${enderecoCompleto}.</p>
            <p class="mb-2"><strong>OUTORGADO:</strong> Sr. Bel. JAIR JOÃO WOLFRAM, brasileiro, advogado, inscrito na OAB/RS sob os nº 35.765, com escritório profissional na Av. Nações Unidas, 2456, Centro, na cidade de Novo Hamburgo /RS.</p>
            <p class="mb-2"><strong>FINALIDADE:</strong> poderes específicos para demandar JUNTO AO GERID OU OUTRA AÇÃO JUDICIAL E ADMINISTRATIVA NECESSÁRIA PARA ENCAMINHAMENTO DO PEDIDO DE AUXILIO MATERNIDADE, junto a Comarca e FORO eleito competente para o feito, bem como demais cominações legais pertinentes in casu.</p>
            <p class="mb-2"><strong>PODERES:</strong> O Outorgante supra, nomeia e constitui seu bastante procurador, Outorgado supra, independente da ordem de nomeação, para o que outorga ao referido procurador os poderes contidos nas cláusulas “ad” e “extra judicia”, bem como os especiais de transigir e substabelecer, no todo ou em parte, com ou sem reservas, os poderes ora outorgados, podendo requerer o BENEFÍCIO DA ASSISTÊNCIA JUDICIÁRIA GRATUÍTA.</p>
            <p class="text-right mt-6 mb-8">Novo Hamburgo(RS), ${longFormattedDate}.</p>
            <div class="text-center mt-12">
                <div class="signature-line w-3/4 mx-auto"></div>
                <p class="mt-1 text-sm">OUTORGANTE</p>
                <p class="mt-1 text-sm">${client.nome_completo || ''}</p>
            </div>
        </div>
    `;
}

// --- CONTROLO DE FORMULÁRIO (TECLA ENTER) ---
form.addEventListener('keydown', (e) => {
    // Apenas atua na tecla enter e ignora textareas e botões
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit' && e.target.tagName !== 'BUTTON') {
        e.preventDefault(); // Impede o envio do formulário
        
        // Encontra todos os elementos focáveis que estão visíveis e não desabilitados
        const focusableElements = Array.from(
            form.querySelectorAll('input:not([type="hidden"]), select, textarea')
        ).filter(el => !el.disabled && el.offsetParent !== null);
        
        const currentIndex = focusableElements.indexOf(e.target);
        const nextElement = focusableElements[currentIndex + 1];
        
        if (nextElement) {
            nextElement.focus(); // Move o foco para o próximo elemento
        }
    }
});