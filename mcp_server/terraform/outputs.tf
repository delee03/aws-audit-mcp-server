# Lambda outputs
output "mcp_server_function_url" {
  description = "Function URL for the MCP server"
  value       = module.mcp_server.lambda_function_url
}

output "lambda_function_name" {
  description = "Name of the Lambda function" 
  value       = module.mcp_server.lambda_function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = module.mcp_server.lambda_function_arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name"
  value       = module.mcp_server.lambda_cloudwatch_log_group_name
}
