locals {
  zip_file = "../aws-audit-mcp-server.zip"
}

module "mcp_server" {
  source = "terraform-aws-modules/lambda/aws"

  function_name = "${var.name}-mcp-server"
  description   = "AWS Documentation MCP Server"
  handler       = "lambda_handler_sse.lambda_handler"
  runtime       = "python3.11"

  # lambda function URL
  create_lambda_function_url = true
  authorization_type         = "NONE"
  # invoke_mode                = "RESPONSE_STREAM"  # Important for SSE

  create_package         = false
  local_existing_package = local.zip_file

  # others
  memory_size   = var.mcp_server_lambda_memory_size
  tags          = var.tags
  timeout       = var.mcp_server_lambda_timeout
}
