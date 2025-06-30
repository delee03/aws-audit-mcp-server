variable "name" {
  type    = string
  default = "aws-docs"
}

# Lambda configuration
variable "mcp_server_lambda_memory_size" {
  type    = number
  default = 256
}

variable "mcp_server_lambda_timeout" {
  type    = number
  default = 60
}

variable "tags" {
  type = map(string)
  default = {
    "Owner" = "Phatpham-Katalon/aws-docs-mcp-server"
  }
}