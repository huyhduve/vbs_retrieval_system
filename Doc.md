# Tổng quan

- Frontend: Vibecode, Vanilla js
- Backend: Fastapi
- VectorDB: Milvus-Lite (LinuxOS Supported Only)
- Internet Tunnel: Ngrok
  - 1 URL/account
  - Req/Min: 4K
  - Data Transfer limit: ~1GB

## I. Features

### 1. Text Search (Completed)

- Cơ chế: Backend nhận text từ frontend, thực hiện search cosine-sim và trả về list các id ảnh

- Đã tách features của toàn bộ keyframes bằng các model
- Insert hết dữ liệu vào database

drive: AIC26vita/Database/features[base, large, so400m]

**TODO:**

    + Cần survey thêm 1-2 model để thử nghiệm

### 2. OCR & ASR (In progress)

- Đã tách xong raw data của OCR, ASR
  - OCR bị nhiễu khá nhiều, chưa có cách lọc (không thể xác định được từ khóa)
  - ASR khá sạch, nhưng chưa xác định model search hoặc thuật search (BM25)

drive: AIC26vita/ASR

Chưa up OCR

**TODO:**

    + Lọc OCR: xóa các từ lặp đi lặp lại quá nhiều lần, tìm thuật toán search (BM25)
    + ASR: xử lí cách map segment dài với các keyframes, tìm thuật search (BM25), embedding model: bge-m3, AITeamVN/Vietnamese_Embeddingv2

### 3. Similarity Search (Completed)

- Cơ chế: Frontend gửi Image_ID được chọn, Backend load file feature .npy của ảnh đó đã được embed và search cosine-sim và trả và trả về list id ảnh

### 4. Image Search (In progress - Đang vibe)

- Cơ chế: Frontend có thêm một mục để paste ảnh -> Backend, Backend encode, query database trả về list id ảnh

### 5.

## II. Why?

### Model

- Sử dụng phối hợp 3 model vision-text embedding, kích thước tăng dần
  - siglip2-base-patch16-224 - Máy Đức
  - siglip2-large-patch16-256 - (Server)
  - siglip2-so400m-patch14-384 - Máy Thắng

_Dùng 3 size khác nhau vì_

- Tiện ở khâu embedding, các khâu preprocessing và postprocessing input tương tự nhau
- Mỗi model đều thỉnh thoảng có những điểm mù trong câu truy vấn, dễ bị nhiễu với tên riêng, ngữ cảnh không đầy đủ
  _->Solution: frontend gọi xoay vòng backend để các model có thể bù đắp_

### Database

- Milvus Lite:
  - So với Faiss thì hoàn chỉnh hơn, hỗ trợ search trên nhiều trường dữ liệu, hỗ trợ thuật search Weighted Ranking - Xác định độ quan trọng của các dữ liệu Text - OCR - ASR
  - Setup đơn giản, nhưng cần chạy môi trường giả lập Linux
