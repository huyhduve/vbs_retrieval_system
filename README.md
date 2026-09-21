## 1. Problem
This repo 


## 2. Inference Stage

- Text - Vision embedding, we use google siglip2 family (base, large, so400m)
- ASR Embedding: hybrid search(BM25, dense[AI_Teams/VietNameseEmbedding])
- OCR: primarily BM25

## 3. Database - Milvus[Lite]

- We choose Milvus[Lite] for its diverse ability when manage database
  - Partitions splitting:
    - clustering dataset according to topic of queries while reducing searching space and cost
  - Builtin BM25 fn
    - Milvus conveniently support BM25 search as its builtin function, so no need to build BM25 func manually
  - All in one db
    - Multi field data support
    - Support weighted result fusion
  - Lite version is light and quick to deploy - however it hasn't support Window

## 