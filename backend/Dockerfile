FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libxrender1 libxext6 libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Verify drawing dependencies during image build.
RUN python -c "from rdkit import Chem; from rdkit.Chem import Draw; d=Draw.MolDraw2DSVG(320,240); d.DrawMolecule(Chem.MolFromSmiles('CCO')); d.FinishDrawing(); assert '<svg' in d.GetDrawingText()"

COPY main.py .
COPY knowledge_engine.py .
COPY phase1_academy_ext.py .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
