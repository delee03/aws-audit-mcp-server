# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM public.ecr.aws/lambda/python:3.11

# Copy requirements file
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies
RUN pip install -r requirements.txt

# Copy source code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Copy the lambda handler
COPY lambda_handler.py ${LAMBDA_TASK_ROOT}

# Create info about available endpoints
RUN echo "AWS Documentation MCP Server - Multiple Endpoints" > ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "Available endpoints:" >> ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "  / - Root service info" >> ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "  /fetch?url=<aws_docs_url> - Direct documentation fetch" >> ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "  /mcp/ - MCP Streamable HTTP transport" >> ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "  /sse/ - MCP SSE transport" >> ${LAMBDA_TASK_ROOT}/endpoints.txt && \
    echo "  Direct invocation - Send JSON-RPC MCP requests" >> ${LAMBDA_TASK_ROOT}/endpoints.txt

# Set the CMD to your handler
CMD [ "lambda_handler.lambda_handler" ]