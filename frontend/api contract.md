# API Contract

This document describes the HTTP calls made by the frontend. All JSON requests use `Content-Type: application/json`.

## 1. Image search

`POST http://127.0.0.1:8000/api/v1/search`

### Request body

```json
{
  "text": "<current Text input>",
  "text_score": "<current Text slider value>",
  "ocr": "<current OCR input>",
  "ocr_score": "<current OCR slider value>",
  "asr": "<current ASR input>",
  "asr_score": "<current ASR slider value>",
  "top_k": "<current Top-K slider value>"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | string | Yes | Value from the **Text** field. May be an empty string when ASR or OCR is used. |
| `asr` | string | Yes | Value from the **ASR** field. May be an empty string. |
| `ocr` | string | Yes | Value from the **OCR** field. May be an empty string. |
| `top_k` | integer | Yes | Number of results requested; UI range is 1-200. |
| `text_score` | number | Yes | Raw value from the Text score slider (`0.00` to `1.00`). |
| `ocr_score` | number | Yes | Raw value from the OCR score slider (`0.00` to `1.00`). |
| `asr_score` | number | Yes | Raw value from the ASR score slider (`0.00` to `1.00`). |

At least one of `query`, `asr`, or `ocr` must be non-empty in the UI.

The UI reads `score_text`, `score_ocr`, and `score_asr` directly from the three sliders when Search is pressed. Each slider is in the range `0.00` to `1.00`; the initial value is `0.50`. The raw values are sent as-is without normalization.

### Successful response

```json
{
  "results": [
    { "image_id": "K01_V001/001.jpg" }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `results` | array | Search result list. |
| `results[].image_id` | string | Keyframe ID used to form the image URL. |

Non-2xx responses are surfaced by the frontend as a search error, with the response body included in the message.

## 2. Backend health check

`GET http://127.0.0.1:8000/api/v1/health`

The frontend expects a successful JSON response. Its internal schema is backend-defined and is not currently rendered in the UI.

## 3. DRES authentication

`POST http://192.168.28.151:5000/api/v2/login`

### Request body

```json
{
  "username": "<configured username>",
  "password": "<configured password>"
}
```

### Response consumed by frontend

```json
{
  "sessionId": "string"
}
```

The returned `sessionId` is stored in browser local storage and used by subsequent DRES calls.

## 4. Get active DRES evaluation

`GET http://192.168.28.151:5000/api/v2/client/evaluation/list/?session={sessionId}`

The frontend chooses the object whose `status` equals `"ACTIVE"` and uses its `id` in the submit URL. 

### Response fields consumed

```json
[
  { "id": "evaluation-id", "name": "Evaluation name", "status": "ACTIVE" }
]
```

## 5. Submit selected keyframe to DRES

`POST http://192.168.28.151:5000/api/v2/submit/{evaluationId}?session={sessionId}`


# KIS-submission
### Request body example

```json
{
  "answerSets": [
    {
      "answers": [
        {
          "mediaItemName": "K01_V001",
          "start": 1000000,
          "end": 1000050
        }
      ]
    }
  ]
}
```


`start` and `end` are calculated from the keyframe CSV mapping: `pts_time * 1000`, with 50 ms added to `end`.

## 6. Keyframe mapping file

`GET map-keyframes-b2/{videoCode}.csv`

The CSV must expose columns named `n` and `pts_time`. The frontend maps the image frame number (`n`) to `pts_time` before submitting a result.
