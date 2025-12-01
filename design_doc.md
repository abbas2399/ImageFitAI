# 🚀 **Design Document – MVP v1**

# **Project: Image Compliance AI (ICA)**

### **One-Line Description**

AI-powered tool that transforms an image to meet strict website requirements using LLM-generated ffmpeg commands.

---

# 1️⃣ **Purpose & Overview**

Many websites (government portals, job apps, real estate sites, ID systems) require images to meet **very specific requirements** such as:

* Max size (e.g., 200 KB)
* Exact dimensions (e.g., 600×600)
* Specific format (e.g., JPEG only)
* Certain aspect ratios
* DPI constraints

Users struggle to manually convert images to these constraints.

This MVP:

* Lets users **upload an image directly to S3**
* Lets users **paste the requirement text in natural language**
* Sends metadata + rules to an LLM
* LLM produces **ffmpeg commands**
* Backend runs them inside a sandbox
* Outputs a **validated compliant image** back to S3

No queues, no multi-container workers for now — **single NestJS backend** handles everything synchronously.

---

# 2️⃣ **High-Level Architecture (MVP v1)**

### **Components**

* **Frontend (React + Vite + TypeScript)**
* **Backend (NestJS)** – runs:

  * Presigned upload URL generation
  * Job creation
  * LLM call
  * ffmpeg execution
  * S3 upload
* **S3 Storage**
* **LLM Provider (AWS Bedrock or equivalent)**

### **Flow Overview**

1. **Frontend validates image (size, type)**
2. **Frontend → Backend:** request presigned URL
3. **Frontend → S3:** direct upload
4. **Frontend → Backend:** create job (includes `jobId`, `s3Key`, `rulesText`)
5. **Backend:**

   * Downloads from S3 → temp directory
   * Probes metadata via `ffprobe`
   * Calls LLM → gets structured constraints + ffmpeg commands
   * Runs commands sequentially in sandbox
   * Validates output
   * Uploads final result to S3
6. **Frontend polls for job completion**
7. **Frontend shows compliant image + summary**

---

# 3️⃣ **ffmpeg Overview**

**ffmpeg** is a command-line tool for manipulating audio and video, including images.

Common image operations:

* Resize (`-vf scale=...`)
* Crop (`-vf crop=...`)
* Pad (`-vf pad=...`)
* Convert formats (`-c:v mjpeg`)
* Compress (`-q:v` for JPEG)
* Extract metadata using `ffprobe`

Official documentation:
🔗 [https://ffmpeg.org/documentation.html](https://ffmpeg.org/documentation.html)

LLM will generate commands such as:

```
ffmpeg -i input.png -vf "scale=600:600:force_original_aspect_ratio=decrease,pad=600:600:(ow-iw)/2:(oh-ih)/2" output.jpg
```

The backend simply executes the commands exactly as returned by the LLM.

---

# 4️⃣ **Natural Language Requirements**

Users paste raw text such as:

> “Image must be JPEG, max 200KB, minimum resolution 600x600, aspect ratio 1:1.”

Backend sends this text (as-is) to LLM with instructions to:

1. Parse constraints
2. Produce sequential ffmpeg commands
3. Produce a final output file name
4. Return strict JSON only

---

# 5️⃣ **System Responsibilities**

### **Frontend Responsibilities**

* Validate:

  * File size limit (e.g., max 50 MB)
  * Accept only image MIME types
* Request presigned S3 upload URL
* Upload file directly to S3
* Send job creation request to backend
* Poll job status endpoint
* Display final image + summary

---

### **Backend (NestJS) Responsibilities**

* Provide `/uploads/presign`
* Provide `/jobs`
* Manage job metadata (DB or in-memory for MVP)
* Download from S3 into temp directory
* Probe metadata via `ffprobe`
* Build prompt + call LLM
* Validate JSON response
* Execute ffmpeg commands inside sandbox
* Validate final output
* Upload processed image to S3
* Return job status and result URI

---

# 6️⃣ **Architecture Diagram (MVP)**

```
Frontend ──> Backend (NestJS) ──> Generates Presigned URL ──> S3
          <─────── Poll Job Status ───────

Frontend ──> S3 Upload Direct

Backend (NestJS) ──> Download from S3
                   ──> ffprobe metadata
                   ──> LLM (Bedrock)
                   ──> Execute ffmpeg commands
                   ──> Upload to S3
```

---

# 7️⃣ **Backend (NestJS) – Structure & Guidelines**

Recommended project layout:

```
src/
  modules/
    uploads/
      uploads.controller.ts
      uploads.service.ts
    jobs/
      jobs.controller.ts
      jobs.service.ts
      jobs.model.ts (or entity)
    llm/
      llm.service.ts
    ffmpeg/
      ffmpeg.service.ts
    s3/
      s3.service.ts
  common/
    utils/
    filters/
    pipes/
  main.ts
```

### **Key NestJS Guidelines**

* Use **ConfigModule** for AWS credentials, bucket name, max upload size.
* Use **HttpModule** for calling the LLM API.
* Use dedicated services:

  * `S3Service` → presigned URL & file download/upload
  * `LlMService` → builds prompts + validates schema
  * `FfmpegService` → runs commands in isolated temp directory
  * `JobsService` → orchestrates everything
* Use **Pipe** to validate `jobId` UUID.
* Use **Interceptors** for logging execution times.

---

# 8️⃣ **Sandbox Execution Rules**

All ffmpeg commands must run in a temporary directory:

```
/tmp/ica/job-{jobId}/
```

Rules:

* Only allow commands starting with `ffmpeg`
* Reject commands containing:

  * `;`
  * `&&`
  * `|`
  * `>`
  * absolute file paths
* Limit execution time per command (~10 seconds)
* Remove directory after finishing

---

# 9️⃣ **LLM Specification**

LLM receives:

* Natural-language rules text
* Extracted image metadata
* Standard prompt with required JSON schema

LLM must return:

```
{
  "constraints": {...},
  "commands": ["ffmpeg -i input.png ... output.jpg", ...],
  "finalOutput": "output.jpg",
  "summary": "Converted PNG to JPEG, resized to 600x600, compressed to meet 200KB"
}
```

Backend must:

* Validate output structure
* Validate no illegal shell operators
* Validate filenames are local-only
* Run commands exactly as provided

---

# 🔟 **Validation Requirements**

Final output must meet parsed constraints:

* Format (if specified)
* Resolution
* Aspect ratio
* Max file size
* DPI (optional for MVP)

If validation fails → mark job as failed with reason.

---

# 1️⃣1️⃣ **API Endpoints (MVP)**

### **POST /uploads/presign**

Returns presigned S3 URL for direct upload.

### **POST /jobs**

Creates a job after S3 upload.
Returns `{ jobId, status }`.

### **GET /jobs/:id**

Returns:

```
{
  jobId,
  status,
  originalImageUrl (presigned),
  outputImageUrl (presigned),
  summary,
  commands,
  constraints
}
```

---

# 1️⃣2️⃣ **Startup Guide for Engineers**

### **Step 1 – Set Up Environment**

Install:

* Node.js + PNPM
* NestJS CLI
* ffmpeg + ffprobe
* AWS credentials (local profile)

Configure `.env`:

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_S3_BUCKET`
* `AWS_REGION`
* `MAX_UPLOAD_SIZE_MB`

---

### **Step 2 – Run Services**

```
pnpm install
pnpm run start:dev
```

Ensure ffmpeg is accessible:

```
ffmpeg -version
ffprobe -version
```

---

### **Step 3 – Development Workflow**

1. Implement presigned upload flow
2. Test S3 uploads from frontend
3. Implement job creation
4. Implement ffprobe metadata extraction
5. Implement LLM integration
6. Implement ffmpeg execution sandbox
7. Test full flow end-to-end
8. Add job polling & UI

---

# 1️⃣3️⃣ **High-Level Task Breakdown (for Sprint Planning)**

### **Phase 1: S3 Upload Pipeline**

* Build `/uploads/presign` endpoint
* Implement frontend file validation
* Implement direct S3 upload
* Add CORS configuration for S3

### **Phase 2: Job Creation**

* Create `/jobs` endpoint
* Store job metadata (in-memory or SQLite for MVP)
* Generate jobId
* Basic response structure

### **Phase 3: Metadata Extraction**

* Implement ffprobe wrapper in `FfmpegService`
* Extract width, height, format, size

### **Phase 4: LLM Integration**

* Implement `LlmService`
* Build prompt with rules + metadata
* Define required JSON schema
* Add validation logic

### **Phase 5: Command Execution**

* Implement sandbox directory logic
* Run ffmpeg commands sequentially
* Sanitize input commands

### **Phase 6: Finalization**

* Validate final image
* Upload output to S3
* Update job state
* Return presigned URL in GET `/jobs/:id`

### **Phase 7: Frontend Integration**

* Job polling
* Display result image
* Display summary + commands

### **Phase 8: Testing**

* End-to-end integration tests
* Error handling and edge cases
* Performance testing with large images

---

# 1️⃣4️⃣ **Non-Functional Requirements**

* **Security**

  * Bucket must be private.
  * Backend must validate command safety.
  * No arbitrary execution allowed.

* **Performance**

  * Typical image transform should complete under 10s.

* **Clean-up**

  * Temp directories must always be deleted after job.