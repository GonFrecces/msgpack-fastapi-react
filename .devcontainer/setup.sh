#!/bin/bash

echo "🚀 Configurando el entorno de desarrollo..."

# Instalar uv
echo "📦 Instalando uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.cargo/bin:$PATH"

# Instalar protoc (Protocol Buffers compiler)
echo "📦 Instalando protoc..."
sudo apt-get update
sudo apt-get install -y protobuf-compiler

# Configurar backend
echo "🐍 Configurando backend..."
cd back
uv sync

# Compilar protobuf
echo "⚙️ Compilando protobuf..."
protoc --python_out=. data.proto

cd ..

# Configurar frontend
echo "⚛️ Configurando frontend..."
cd front
npm install

# Copiar archivo proto a public
cp ../back/data.proto public/

cd ..

echo "✅ Configuración completada!"
echo ""
echo "Para ejecutar el proyecto:"
echo "  Backend: cd back && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0"
echo "  Frontend: cd front && npm run dev"
