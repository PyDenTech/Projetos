document.addEventListener('DOMContentLoaded', function () {
    carregarUsuarios();
});

function carregarUsuarios() {
    fetch('/api/usuarios-pendentes')
        .then(response => response.json())
        .then(users => {
            const tableBody = document.getElementById('userTableBody');
            tableBody.innerHTML = ''; // Clear table before reloading
            users.forEach(user => {
                const row = `<tr>
                <td>${user.id}</td>
                <td>${user.nome}</td>
                <td>${user.email}</td>
                <td>${user.init ? 'Ativo' : 'Pendente'}</td>
                <td>
                    <select class="form-control" onchange="alterarCargo(${user.id}, this.value)">
                        <option value="">Selecionar Cargo</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="gestor" ${user.role === 'gestor' ? 'selected' : ''}>Gestor</option>
                        <option value="agente" ${user.role === 'agente' ? 'selected' : ''}>Agente</option>
                        <option value="fornecedor" ${user.role === 'fornecedor' ? 'selected' : ''}>Fornecedor</option>
                        <option value="motorista" ${user.role === 'motorista' ? 'selected' : ''}>Motorista</option>
                        <option value="monitor" ${user.role === 'monitor' ? 'selected' : ''}>Monitor</option>
                        <option value="visitante" ${user.role === 'visitante' ? 'selected' : ''}>Visitante</option>
                    </select>
                </td>
                <td>
                    ${!user.init ? `<button class="btn btn-success btn-sm" onclick="alterarStatus(${user.id}, true)">Aprovar</button>` : `<button class="btn btn-warning btn-sm" onclick="alterarStatus(${user.id}, false)">Rejeitar</button>`}
                    <button class="btn btn-danger btn-sm" onclick="excluirUsuario(${user.id})">Excluir</button>
                </td>
            </tr>`;
                tableBody.innerHTML += row;
            });
        })
        .catch(error => console.error('Erro ao buscar usuários:', error));
}

function alterarStatus(userId, status) {
    fetch(`/api/usuarios/${userId}/status`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ init: status })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            alert(data.message);
            location.reload(); // Recarrega a página para atualizar os dados da tabela
        })
        .catch(error => {
            console.error('Erro ao alterar status do usuário:', error);
            alert('Erro ao processar a solicitação.');
        });
}

function excluirUsuario(userId) {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
        fetch(`/api/usuarios/${userId}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                alert(data.message);
                location.reload(); // Recarrega a página para atualizar os dados da tabela
            })
            .catch(error => {
                console.error('Erro ao excluir usuário:', error);
                alert('Erro ao processar a solicitação.');
            });
    }
}

function alterarCargo(userId, novoCargo) {
    fetch(`/api/usuarios/${userId}/cargo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: novoCargo })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            if (data.success) {
                location.reload(); // Recarrega para atualizar os dados da tabela
            }
        })
        .catch(error => console.error('Erro ao alterar o cargo do usuário:', error));
}

document.addEventListener('DOMContentLoaded', function () {
    carregarEstados();
});

function carregarEstados() {
    fetch('/estados')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('estadoSelect');
            select.innerHTML = '<option>Selecione um Estado</option>';
            data.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.codigo_uf;
                option.textContent = estado.nome;
                select.appendChild(option);
            });
        })
        .catch(error => console.error('Erro ao buscar estados:', error));
}

// Função para carregar municípios baseado no estado selecionado
function carregarMunicipios(codigoEstado) {
    fetch(`/municipios/${codigoEstado}`)
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('municipioSelect');
            select.innerHTML = '<option>Selecione um Município</option>';
            data.forEach(municipio => {
                const option = document.createElement('option');
                option.value = municipio.codigo_ibge;
                option.textContent = municipio.nome;
                select.appendChild(option);
            });
        })
        .catch(error => console.error('Erro ao buscar municípios:', error));
}

// Função para filtrar usuários por município
function filtrarUsuariosPorMunicipio(codigoMunicipio) {
    fetch(`/usuarios/${codigoMunicipio}`)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('userTableBody');
            tbody.innerHTML = '';
            data.forEach(usuario => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${usuario.id}</td>
                    <td>${usuario.nome}</td>
                    <td>${usuario.email}</td>
                    <td>${usuario.status}</td>
                    <td>${usuario.cargo}</td>
                    <td><button class="btn btn-primary btn-sm">Ações</button></td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => console.error('Erro ao buscar usuários:', error));
}

// Carregar os estados ao carregar a página
carregarEstados();

// Adicionar eventos aos selects
document.getElementById('estadoSelect').addEventListener('change', function () {
    carregarMunicipios(this.value);
});

document.getElementById('municipioSelect').addEventListener('change', function () {
    filtrarUsuariosPorMunicipio(this.value);
});


document.getElementById('cadastrarBtn').addEventListener('click', async () => {
    const nomeBairro = document.getElementById('nomeBairro').value;

    try {
        const response = await fetch('/api/cadastrar-bairro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nomeBairro }),
        });

        if (response.ok) {
            alert('Bairro cadastrado com sucesso!');
            document.getElementById('zonaForm').reset();
        } else {
            const errorData = await response.json();
            alert(`Erro ao cadastrar bairro: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        alert('Erro ao cadastrar bairro. Tente novamente mais tarde.');
    }
});

function carregarBairros() {
    fetch('/api/bairros')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('bairrosTableBody');
            tableBody.innerHTML = '';
            data.forEach(bairro => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${bairro.id}</td>
                    <td>${bairro.nome}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="editarBairro(${bairro.id}, '${bairro.nome}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="excluirBairro(${bairro.id})">Excluir</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(error => console.error('Erro ao carregar bairros:', error));
}

// Editar bairro
function editarBairro(id, nome) {
    $('#editModal').modal('show');
    document.getElementById('editNomeBairro').value = nome;
    document.getElementById('salvarEdicaoBtn').onclick = () => {
        const novoNome = document.getElementById('editNomeBairro').value;
        fetch(`/api/editar-bairro/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomeBairro: novoNome })
        })
            .then(response => response.json())
            .then(data => {
                alert('Bairro editado com sucesso!');
                $('#editModal').modal('hide');
                carregarBairros();
            })
            .catch(error => console.error('Erro ao editar bairro:', error));
    };
}

// Excluir bairro
function excluirBairro(id) {
    if (confirm('Tem certeza que deseja excluir este bairro?')) {
        fetch(`/api/excluir-bairro/${id}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                alert('Bairro excluído com sucesso!');
                carregarBairros();
            })
            .catch(error => console.error('Erro ao excluir bairro:', error));
    }
}

// Carregar bairros ao carregar a página
document.addEventListener('DOMContentLoaded', carregarBairros);
