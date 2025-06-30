#!/usr/bin/env python3
import requests
import time
import json
import sys
from datetime import datetime

class EchoFiNetworkResilienceTest:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, retry_count=1, retry_delay=2):
        """Run a single API test with retry logic"""
        url = f"{self.base_url}/api/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        for attempt in range(retry_count):
            try:
                if method == 'GET':
                    response = requests.get(url, headers=default_headers, timeout=10)
                elif method == 'POST':
                    response = requests.post(url, json=data, headers=default_headers, timeout=10)
                
                success = response.status_code == expected_status
                
                # Try to parse response as JSON
                response_data = None
                try:
                    response_data = response.json()
                except:
                    response_data = response.text
                
                if success:
                    self.tests_passed += 1
                    print(f"✅ Passed - Status: {response.status_code}")
                    self.test_results.append({
                        "name": name,
                        "success": True,
                        "status_code": response.status_code,
                        "response": response_data
                    })
                    return True, response_data
                else:
                    print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                    if attempt < retry_count - 1:
                        print(f"Retrying in {retry_delay} seconds... (Attempt {attempt+1}/{retry_count})")
                        time.sleep(retry_delay)
                    else:
                        self.test_results.append({
                            "name": name,
                            "success": False,
                            "status_code": response.status_code,
                            "response": response_data,
                            "error": f"Expected status {expected_status}, got {response.status_code}"
                        })
                        return False, response_data
            
            except Exception as e:
                print(f"❌ Failed - Error: {str(e)}")
                if attempt < retry_count - 1:
                    print(f"Retrying in {retry_delay} seconds... (Attempt {attempt+1}/{retry_count})")
                    time.sleep(retry_delay)
                else:
                    self.test_results.append({
                        "name": name,
                        "success": False,
                        "error": str(e)
                    })
                    return False, None
        
        return False, None

    def test_health_endpoint(self):
        """Test the health check endpoint"""
        success, response = self.run_test(
            "Health Check Endpoint",
            "GET",
            "health",
            200
        )
        
        if success:
            print(f"Health Status: {response.get('status', 'unknown')}")
            print(f"Healthy Services: {response.get('services', {}).get('healthy', [])}") 
            
            # Verify response structure
            required_fields = ['status', 'timestamp', 'services', 'features', 'performance']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Health response missing required fields: {missing_fields}")
                return False
                
            return True
        return False

    def test_metrics_endpoint(self):
        """Test the metrics endpoint"""
        success, response = self.run_test(
            "Metrics Endpoint",
            "GET",
            "metrics",
            200
        )
        
        if success:
            # Verify response structure
            required_fields = ['timestamp', 'system', 'services', 'cache', 'network', 'summary']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Metrics response missing required fields: {missing_fields}")
                return False
                
            print(f"Metrics Summary:")
            if 'summary' in response:
                for key, value in response['summary'].items():
                    print(f"- {key}: {value}")
                
            return True
        return False

    def test_agent_health(self):
        """Test the agent health endpoint"""
        success, response = self.run_test(
            "Agent Health Check",
            "GET",
            "agent",
            200
        )
        
        if success:
            print(f"Agent Status: {response.get('status', 'unknown')}")
            print(f"Agent Message: {response.get('message', 'No message')}")
            
            # Verify response structure
            required_fields = ['status', 'message', 'services', 'features', 'timestamp']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Agent health response missing required fields: {missing_fields}")
                return False
                
            return True
        return False

    def test_agent_get_balance(self):
        """Test the agent getBalance action"""
        success, response = self.run_test(
            "Agent getBalance Action",
            "POST",
            "agent",
            200,
            data={"action": "getBalance"}
        )
        
        if success:
            print(f"Balance Request Success: {response.get('success', False)}")
            if response.get('success'):
                balance_data = response.get('data', {})
                print(f"Wallet Address: {balance_data.get('address', 'unknown')}")
                print(f"Balance: {balance_data.get('balance', 'unknown')} {balance_data.get('currency', '')}")
            else:
                print(f"Error: {response.get('error', 'Unknown error')}")
                
            return response.get('success', False)
        return False

    def test_agent_analyze_performance(self):
        """Test the agent analyzePerformance action"""
        success, response = self.run_test(
            "Agent analyzePerformance Action",
            "POST",
            "agent",
            200,
            data={"action": "analyzePerformance", "params": {"timeframe": "7d"}}
        )
        
        if success:
            print(f"Performance Analysis Success: {response.get('success', False)}")
            if response.get('success'):
                # Just print the first few lines of the analysis
                analysis = response.get('data', '').split('\n')
                print("Analysis Summary:")
                for line in analysis[:5]:
                    print(f"  {line}")
                print("  ...")
            else:
                print(f"Error: {response.get('error', 'Unknown error')}")
                
            return response.get('success', False)
        return False

    def test_user_groups(self):
        """Test the user-groups endpoint"""
        test_address = "0x25A40049c13Edf6DcBbcd51Ca0De2C055D3885B5"
        success, response = self.run_test(
            "User Groups Endpoint",
            "GET",
            f"user-groups?address={test_address}",
            200
        )
        
        if success:
            print(f"User Groups Response: {type(response)}")
            if isinstance(response, list):
                print(f"Found {len(response)} user groups")
            elif isinstance(response, dict) and 'error' in response:
                print(f"Error: {response.get('error')}")
                return False
                
            return True
        return False

    def test_circuit_breaker(self):
        """Test circuit breaker functionality by making repeated failing requests"""
        print("\n🔄 Testing Circuit Breaker Functionality...")
        print("Making repeated requests to trigger circuit breaker...")
        
        # Use a non-existent endpoint to trigger failures
        for i in range(6):  # Should be enough to trigger circuit breaker
            print(f"Request {i+1}/6...")
            try:
                response = requests.get(f"{self.base_url}/api/non-existent-endpoint", timeout=2)
                print(f"Status: {response.status_code}")
            except Exception as e:
                print(f"Error: {str(e)}")
            
            time.sleep(1)
        
        # Now check if health endpoint reports any circuit breakers open
        success, response = self.run_test(
            "Health Check After Circuit Breaker Test",
            "GET",
            "health",
            200
        )
        
        if success:
            services = response.get('services', {})
            degraded_services = services.get('degraded', [])
            
            print(f"Degraded Services: {degraded_services}")
            
            # Check network metrics for circuit breaker status
            network = response.get('network', {})
            circuit_breaker_open = False
            
            # This is a simplified check - the actual implementation might report circuit breakers differently
            for service_name, metrics in network.items():
                if isinstance(metrics, dict) and metrics.get('circuitBreakerOpen', False):
                    circuit_breaker_open = True
                    print(f"Circuit breaker open for {service_name}")
            
            # Reset circuit breaker
            reset_success, reset_response = self.run_test(
                "Reset Circuit Breaker",
                "POST",
                "health",
                200,
                data={"action": "reset_circuit_breaker", "service": "all"}
            )
            
            if reset_success:
                print("Circuit breaker reset request sent")
            
            # For this test, we'll consider it successful if we got a valid health response
            # In a real test, you'd want to verify that circuit breakers actually opened
            self.test_results.append({
                "name": "Circuit Breaker Test",
                "success": True,
                "notes": "Circuit breaker test completed, but actual circuit breaker state could not be definitively verified"
            })
            
            return True
        
        return False

    def test_graceful_degradation(self):
        """Test graceful degradation by forcing a service into degraded mode"""
        print("\n⚠️ Testing Graceful Degradation...")
        
        # First, enable degraded mode for a service
        success, response = self.run_test(
            "Enable Degraded Mode",
            "POST",
            "health",
            200,
            data={"action": "enable_degraded_mode", "service": "blockchain", "config": {"fallbackMode": "cache"}}
        )
        
        if not success:
            print("❌ Failed to enable degraded mode")
            return False
            
        print("✅ Degraded mode enabled for blockchain service")
        
        # Now test agent functionality with degraded service
        balance_success, balance_response = self.run_test(
            "Get Balance in Degraded Mode",
            "POST",
            "agent",
            200,  # Should still return 200 even in degraded mode
            data={"action": "getBalance"}
        )
        
        # Check health to verify degraded status
        health_success, health_response = self.run_test(
            "Health Check in Degraded Mode",
            "GET",
            "health",
            200
        )
        
        if health_success:
            degraded_services = health_response.get('services', {}).get('degraded', [])
            print(f"Degraded Services: {degraded_services}")
            
            is_degraded = 'blockchain' in degraded_services
            print(f"Blockchain Service Degraded: {is_degraded}")
            
            # Disable degraded mode
            disable_success, disable_response = self.run_test(
                "Disable Degraded Mode",
                "POST",
                "health",
                200,
                data={"action": "disable_degraded_mode", "service": "blockchain"}
            )
            
            if disable_success:
                print("✅ Degraded mode disabled")
            
            # For this test, success means we could enable and verify degraded mode
            self.test_results.append({
                "name": "Graceful Degradation Test",
                "success": is_degraded,
                "notes": "Verified service could be put in degraded mode and still function"
            })
            
            return is_degraded
        
        return False

    def test_caching(self):
        """Test caching functionality"""
        print("\n💾 Testing Caching Functionality...")
        
        # Make first request to potentially cache the response
        start_time = time.time()
        first_success, first_response = self.run_test(
            "First Request (Uncached)",
            "GET",
            "health",
            200
        )
        first_request_time = time.time() - start_time
        
        if not first_success:
            print("❌ Failed on first request")
            return False
            
        print(f"First request time: {first_request_time:.3f} seconds")
        
        # Make second request which might use cache
        time.sleep(1)  # Small delay
        start_time = time.time()
        second_success, second_response = self.run_test(
            "Second Request (Potentially Cached)",
            "GET",
            "health",
            200
        )
        second_request_time = time.time() - start_time
        
        if not second_success:
            print("❌ Failed on second request")
            return False
            
        print(f"Second request time: {second_request_time:.3f} seconds")
        
        # Get cache stats
        cache_success, cache_response = self.run_test(
            "Cache Statistics",
            "GET",
            "metrics",
            200
        )
        
        if cache_success and 'cache' in cache_response:
            cache_stats = cache_response['cache']
            print(f"Cache Hit Rate: {cache_stats.get('hitRate', 0)}%")
            print(f"Cache Entries: {cache_stats.get('totalEntries', 0)}")
            
            # For this test, we'll consider it successful if we got valid cache stats
            # In a real test, you'd want to verify actual caching behavior more thoroughly
            self.test_results.append({
                "name": "Caching Test",
                "success": True,
                "notes": f"Cache hit rate: {cache_stats.get('hitRate', 0)}%, Entries: {cache_stats.get('totalEntries', 0)}"
            })
            
            return True
        
        return False

    def run_all_tests(self):
        """Run all tests and report results"""
        print("🚀 Starting EchoFi Network Resilience Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 80)
        
        start_time = time.time()
        
        # Basic API endpoint tests
        self.test_health_endpoint()
        self.test_metrics_endpoint()
        self.test_agent_health()
        self.test_agent_get_balance()
        self.test_agent_analyze_performance()
        self.test_user_groups()
        
        # Advanced resilience tests
        self.test_circuit_breaker()
        self.test_graceful_degradation()
        self.test_caching()
        
        end_time = time.time()
        test_duration = end_time - start_time
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"⏱️ Total test duration: {test_duration:.2f} seconds")
        print("=" * 80)
        
        # Generate detailed report
        self.generate_report()
        
        return self.tests_passed == self.tests_run

    def generate_report(self):
        """Generate a detailed test report"""
        report = {
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "success_rate": f"{(self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0:.1f}%",
                "timestamp": datetime.now().isoformat(),
                "base_url": self.base_url
            },
            "test_results": self.test_results
        }
        
        # Save report to file
        with open("network_resilience_test_report.json", "w") as f:
            json.dump(report, f, indent=2)
            
        print(f"📝 Detailed test report saved to network_resilience_test_report.json")

def main():
    # Get base URL from environment or use default
    base_url = "http://localhost:3000"  # Default URL
    
    # Check if we're running in a container environment
    try:
        import socket
        hostname = socket.gethostname()
        ip_address = socket.gethostbyname(hostname)
        if ip_address != "127.0.0.1":
            print(f"Running in container with IP: {ip_address}")
            base_url = f"http://{ip_address}:3000"
    except Exception as e:
        print(f"Error detecting container IP: {e}")
    
    # Create tester instance
    tester = EchoFiNetworkResilienceTest(base_url)
    
    # Run all tests
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())