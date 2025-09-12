# Gerenciador de Clientes (CRM) para Processos de Salário-Maternidade
Este é um sistema completo de CRM (Customer Relationship Management) desenvolvido como uma aplicação de página única (SPA) para gerir clientes e automatizar a geração de documentos para processos de Salário-Maternidade.

O projeto foi construído para otimizar o fluxo de trabalho de escritórios de advocacia ou assessoria, centralizando todas as informações dos clientes, controlo financeiro e documentação num único local seguro e de fácil acesso.

✨ Funcionalidades Principais
Autenticação de Utilizador: Sistema de login e registo seguro utilizando Firebase Authentication.

Dashboard de Métricas: Visualização rápida de indicadores chave, como número total de clientes, status dos processos (Pendente, Em Análise, Concluído), e valores a receber vs. recebidos.

Cadastro Completo de Clientes: Formulário detalhado para recolher todas as informações pessoais, de trabalho e de maternidade necessárias para o processo.

Edição e Gestão de Clientes: Funcionalidade completa de CRUD (Criar, Ler, Atualizar, Apagar) para os registos dos clientes.

Filtro e Pesquisa: Ferramenta de busca para encontrar clientes rapidamente por nome ou CPF.

Gestão de Anotações: Adicione notas com data e hora a cada cliente para manter um histórico detalhado do processo.

Upload de Anexos: Sistema de upload de ficheiros (documentos, imagens) seguro para cada cliente, com barra de progresso, utilizando o Firebase Storage.

Geração Automática de Documentos:

Criação de Ficha Cadastral em PDF.

Criação de Contrato de Prestação de Serviços e Procuração em PDF.

Lixeira: Os clientes apagados são enviados para uma lixeira, permitindo a sua restauração ou exclusão permanente.

🚀 Tecnologias Utilizadas
Frontend: HTML5, Tailwind CSS, JavaScript (ES6 Modules)

Backend & Base de Dados: Google Firebase

Firebase Authentication: Para a gestão de utilizadores.

Firestore: Como base de dados NoSQL em tempo real para armazenar os dados dos clientes.

Firebase Storage: Para o armazenamento seguro dos ficheiros anexados.

⚙️ Configuração
Para executar este projeto, é necessário ter uma conta no Firebase e configurar um novo projeto.

Crie um projeto no Firebase Console.

Ative os seguintes serviços:

Authentication (com o provedor E-mail/Senha).

Firestore Database.

Storage.

Obtenha as suas credenciais de configuração do Firebase (apiKey, authDomain, etc.).

No ficheiro index.html, substitua o objeto firebaseConfig pelas suas próprias credenciais:

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
